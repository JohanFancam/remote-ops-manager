/**
 * Import the real crew from a CSV or JSON file exported from the old project.
 *
 * Usage:
 *   node scripts/import-users.mjs users.csv             # dry run
 *   node scripts/import-users.mjs users.csv --confirm   # create/update
 *
 * CSV needs a header row; these column names are recognised (case-insensitive):
 *   email          (required)
 *   full_name  |  name  |  first_name + last_name
 *   role           admin | standby | accounts | user   (default: user)
 *
 * JSON must be an array of objects with the same fields.
 *
 * Creates a PendingUser (so the name/role shows in Manage Users) and a login
 * account. Existing accounts keep their password and are updated in place.
 */
import fs from 'fs';
import path from 'path';
import { findUserByEmail, createUser, updateUser } from '../server/auth.js';
import { listEntities, createEntity, updateEntity } from '../server/entities.js';

const [fileArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const confirm = process.argv.includes('--confirm');
const defaultPassword = process.env.DEFAULT_PASSWORD || '';

if (!fileArg) {
  console.error('Usage: node scripts/import-users.mjs <users.csv|users.json> [--confirm]');
  process.exit(1);
}

const filePath = path.resolve(fileArg);
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const VALID_ROLES = new Set(['admin', 'standby', 'accounts', 'user']);

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  });
}

function normaliseRole(raw) {
  const role = String(raw || '').trim().toLowerCase();
  if (VALID_ROLES.has(role)) return role;
  if (['operator', 'remote', 'remote operator', ''].includes(role)) return 'user';
  if (role.includes('admin')) return 'admin';
  if (role.includes('standby')) return 'standby';
  if (role.includes('account')) return 'accounts';
  return 'user';
}

function normaliseRow(row) {
  const email = String(row.email || row.user_email || '').trim().toLowerCase();
  const name = row.full_name || row.name || row.display_name
    || [row.first_name, row.last_name].filter(Boolean).join(' ');
  return {
    email,
    full_name: String(name || '').trim(),
    role: normaliseRole(row.role || row.user_role),
  };
}

const raw = fs.readFileSync(filePath, 'utf8');
const rows = filePath.endsWith('.json') ? JSON.parse(raw) : parseCsv(raw);

const seen = new Set();
const people = [];
const skipped = [];

for (const row of Array.isArray(rows) ? rows : []) {
  const person = normaliseRow(row);
  if (!person.email || !person.email.includes('@')) {
    skipped.push(row);
    continue;
  }
  if (seen.has(person.email)) continue;
  seen.add(person.email);
  people.push(person);
}

console.log(`Parsed ${people.length} users from ${path.basename(filePath)}`);
people.forEach((p) => console.log(`  ${p.role.padEnd(8)} ${p.email}${p.full_name ? ` — ${p.full_name}` : ''}`));
if (skipped.length) console.log(`Skipped ${skipped.length} row(s) without a usable email`);

if (!confirm) {
  console.log('\nDry run. Re-run with --confirm to import.');
  if (!defaultPassword) {
    console.log('Tip: set DEFAULT_PASSWORD=... to also create logins; otherwise users self-register.');
  }
  process.exit(0);
}

const pendingUsers = listEntities('PendingUser', null, 5000);
let createdPending = 0;
let updatedPending = 0;
let createdLogins = 0;
let updatedLogins = 0;

for (const person of people) {
  const existingPending = pendingUsers.find(
    (p) => String(p.email || '').toLowerCase() === person.email
  );
  if (existingPending) {
    updateEntity('PendingUser', existingPending.id, {
      full_name: person.full_name || existingPending.full_name || '',
      role: person.role,
      invited: true,
      inactive: false,
    });
    updatedPending += 1;
  } else {
    createEntity('PendingUser', {
      email: person.email,
      full_name: person.full_name,
      role: person.role,
      invited: true,
    });
    createdPending += 1;
  }

  const existingUser = findUserByEmail(person.email);
  if (existingUser) {
    updateUser(existingUser.id, {
      full_name: person.full_name || existingUser.full_name,
      role: person.role,
      standby: person.role === 'standby' ? true : !!existingUser.standby,
    });
    updatedLogins += 1;
  } else if (defaultPassword) {
    createUser({
      email: person.email,
      password: defaultPassword,
      full_name: person.full_name,
      role: person.role,
      standby: person.role === 'standby',
    });
    createdLogins += 1;
  }
}

console.log(`\nManage Users entries: ${createdPending} created, ${updatedPending} updated`);
console.log(`Login accounts: ${createdLogins} created, ${updatedLogins} updated`);
if (!defaultPassword && createdLogins === 0) {
  console.log('No passwords set — users register at /register with these exact emails.');
}
console.log('\nRestart the app: pm2 restart remote-ops --update-env');
