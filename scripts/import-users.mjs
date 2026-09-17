/**
 * Import the real crew from a CSV or JSON file exported from the old project.
 *
 * Usage:
 *   node scripts/import-users.mjs users.csv                          # dry run
 *   node scripts/import-users.mjs users.csv --confirm                # no logins
 *   node scripts/import-users.mjs users.csv --confirm --generate-passwords
 *   DEFAULT_PASSWORD=Start123 node scripts/import-users.mjs users.csv --confirm
 *
 * CSV needs a header row; these column names are recognised (case-insensitive):
 *   email          (required)
 *   full_name  |  name  |  first_name + last_name
 *   role           admin | standby | accounts | user   (default: user)
 *
 * JSON must be an array of objects with the same fields.
 *
 * Password options:
 *   --generate-passwords   unique random password per new account, printed once
 *   DEFAULT_PASSWORD=...   same starting password for every new account
 *   neither                no logins created; people self-register
 *   --reset-passwords      also re-issue passwords for accounts that exist
 *
 * Creates a PendingUser (so the name/role shows in Manage Users) plus the login.
 * Existing accounts keep their password unless --reset-passwords is passed.
 */
import fs from 'fs';
import path from 'path';
import { randomInt } from 'crypto';
import { findUserByEmail, createUser, updateUser } from '../server/auth.js';
import { listEntities, createEntity, updateEntity } from '../server/entities.js';

const [fileArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const confirm = process.argv.includes('--confirm');
const generatePasswords = process.argv.includes('--generate-passwords');
const resetPasswords = process.argv.includes('--reset-passwords');
const defaultPassword = process.env.DEFAULT_PASSWORD || '';

if (!fileArg) {
  console.error('Usage: node scripts/import-users.mjs <users.csv|users.json> [--confirm] [--generate-passwords] [--reset-passwords]');
  process.exit(1);
}

// Omits characters that get misread when a password is typed from a message: 0/O, 1/l/I
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generatePassword(length = 12) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return out;
}

function passwordFor(person) {
  if (generatePasswords) return generatePassword();
  if (defaultPassword) return defaultPassword;
  return '';
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

function isTruthy(value) {
  return ['true', '1', 'yes', 'y'].includes(String(value || '').trim().toLowerCase());
}

function normaliseRow(row) {
  const email = String(row.email || row.user_email || '').trim().toLowerCase();
  const name = row.full_name || row.name || row.display_name
    || [row.first_name, row.last_name].filter(Boolean).join(' ');
  return {
    email,
    full_name: String(name || '').trim(),
    role: normaliseRole(row.role || row.user_role),
    // Exports carry a "not in use" flag; keep those people listed but unable to sign in
    inactive: isTruthy(row.inactive),
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
people.forEach((p) => console.log(
  `  ${p.role.padEnd(8)} ${p.email}${p.full_name ? ` — ${p.full_name}` : ''}${p.inactive ? '  [not in use]' : ''}`
));
if (skipped.length) console.log(`Skipped ${skipped.length} row(s) without a usable email`);

if (generatePasswords) {
  console.log('\nPasswords: a unique random one per new account, printed at the end.');
} else if (defaultPassword) {
  console.log('\nPasswords: DEFAULT_PASSWORD applied to every new account.');
} else {
  console.log('\nPasswords: none — people self-register at /register with these emails.');
}

if (!confirm) {
  console.log('\nDry run. Re-run with --confirm to import.');
  if (!generatePasswords && !defaultPassword) {
    console.log('Add --generate-passwords (or set DEFAULT_PASSWORD=...) to create logins too.');
  }
  process.exit(0);
}

const pendingUsers = listEntities('PendingUser', null, 5000);
let createdPending = 0;
let updatedPending = 0;
let createdLogins = 0;
let updatedLogins = 0;
let skippedInactive = 0;
const issued = [];

for (const person of people) {
  const existingPending = pendingUsers.find(
    (p) => String(p.email || '').toLowerCase() === person.email
  );
  if (existingPending) {
    updateEntity('PendingUser', existingPending.id, {
      full_name: person.full_name || existingPending.full_name || '',
      role: person.role,
      invited: true,
      inactive: person.inactive,
    });
    updatedPending += 1;
  } else {
    createEntity('PendingUser', {
      email: person.email,
      full_name: person.full_name,
      role: person.role,
      invited: true,
      inactive: person.inactive,
    });
    createdPending += 1;
  }

  const existingUser = findUserByEmail(person.email);
  if (existingUser) {
    const patch = {
      full_name: person.full_name || existingUser.full_name,
      role: person.role,
      standby: person.role === 'standby' ? true : !!existingUser.standby,
      inactive: person.inactive,
    };
    const newPassword = resetPasswords && !person.inactive ? passwordFor(person) : '';
    if (newPassword) {
      patch.password = newPassword;
      issued.push({ email: person.email, password: newPassword, status: 'reset' });
    }
    updateUser(existingUser.id, patch);
    updatedLogins += 1;
  } else if (person.inactive) {
    // Listed in Manage Users but no sign-in until reactivated
    skippedInactive += 1;
  } else {
    const password = passwordFor(person);
    if (password) {
      createUser({
        email: person.email,
        password,
        full_name: person.full_name,
        role: person.role,
        standby: person.role === 'standby',
      });
      issued.push({ email: person.email, password, status: 'new' });
      createdLogins += 1;
    }
  }
}

console.log(`\nManage Users entries: ${createdPending} created, ${updatedPending} updated`);
console.log(`Login accounts: ${createdLogins} created, ${updatedLogins} updated`);
if (skippedInactive) {
  console.log(`Marked "not in use", no login created: ${skippedInactive}`);
}

if (issued.length) {
  const width = Math.max(...issued.map((i) => i.email.length));
  console.log('\nPasswords — shown once, they are stored hashed:');
  for (const item of issued) {
    console.log(`  ${item.email.padEnd(width)}  ${item.password}  (${item.status})`);
  }
  console.log('\nSend each person their own password privately and have them change it after signing in.');
} else if (generatePasswords || defaultPassword) {
  console.log('Every account already existed, so no new passwords were issued.');
  console.log('Add --reset-passwords to re-issue them.');
} else {
  console.log('No passwords set — users register at /register with these exact emails.');
}

console.log('\nRestart the app: pm2 restart remote-ops --update-env');
