/**
 * Re-issue unique random passwords for existing logins. No CSV needed.
 *
 * Usage:
 *   node scripts/reset-passwords.mjs                         # dry run
 *   node scripts/reset-passwords.mjs --confirm               # every active login
 *   node scripts/reset-passwords.mjs --confirm --keep johan@fancam.com
 *   node scripts/reset-passwords.mjs --confirm --email a@b.com --email c@d.com
 *
 * Printed once. Stored hashed afterwards — copy or redirect the output
 * before closing the terminal.
 */
import { resetLoginPasswords, listUserRows } from '../server/auth.js';
import { formatPasswordList } from '../server/passwords.js';

const confirm = process.argv.includes('--confirm');
const args = process.argv.slice(2);

function flagValues(name) {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === `--${name}` && args[i + 1] && !args[i + 1].startsWith('--')) {
      out.push(args[i + 1].trim().toLowerCase());
    }
  }
  return out;
}

const keep = new Set(flagValues('keep'));
const requested = flagValues('email');
const rows = listUserRows();
const byEmail = new Map(rows.map((r) => [String(r.email).toLowerCase(), r]));
const pool = requested.length ? requested : rows.map((r) => String(r.email).toLowerCase());

const plan = [];
const seen = new Set();
for (const email of pool) {
  if (!email || seen.has(email)) continue;
  seen.add(email);
  const row = byEmail.get(email);
  if (!row) {
    plan.push({ email, action: 'miss', detail: 'no login' });
  } else if (row.inactive) {
    plan.push({ email, action: 'skip', detail: 'not in use' });
  } else if (keep.has(email)) {
    plan.push({ email, action: 'keep', detail: row.full_name || row.role });
  } else {
    plan.push({
      email,
      action: 'reset',
      detail: `${row.full_name || ''} (${row.role})`.trim(),
    });
  }
}

for (const item of plan) {
  const label = item.action.padEnd(5);
  console.log(`  ${label} ${item.email}${item.detail ? `  ${item.detail}` : ''}`);
}

const toReset = plan.filter((p) => p.action === 'reset').map((p) => p.email);
console.log(`\n${toReset.length} password(s) would be issued.`);

if (!confirm) {
  console.log('Dry run. Re-run with --confirm to generate new passwords.');
  console.log('Copy the printed list immediately — it cannot be shown again.');
  process.exit(0);
}

if (!toReset.length) {
  console.log('Nothing to reset.');
  process.exit(0);
}

const result = resetLoginPasswords({ emails: toReset, includeSkipEmail: true });
console.log(`\nIssued ${result.issued.length} password(s).`);
if (result.skipped.length) {
  for (const item of result.skipped) {
    console.log(`  skipped ${item.email}  (${item.reason})`);
  }
}

if (result.issued.length) {
  console.log('\nPasswords — shown once, they are stored hashed:');
  console.log(formatPasswordList(result.issued).split('\n').map((line) => `  ${line}`).join('\n'));
  console.log('\nSend each person their own password privately.');
}
