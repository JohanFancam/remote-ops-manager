/**
 * Remove the demo dataset (sample shoots, rig profiles, teams, and @example.com
 * crew) from a live database, keeping real users and app settings.
 *
 * Usage:
 *   node scripts/clear-demo-data.mjs            # dry run: show what would go
 *   node scripts/clear-demo-data.mjs --confirm  # actually delete
 *
 * Keeps the configured rates/settings and writes a marker so the server never
 * re-seeds demo data on restart.
 */
import { db } from '../server/db.js';
import { DEMO_SEED_DISABLED_KEY } from '../server/seed.js';

const confirm = process.argv.includes('--confirm');
const keepEmails = new Set(
  (process.env.KEEP_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

// Operational records: all demo rows live here. Settings are preserved separately.
const WIPE_ENTITY_TYPES = [
  'Shoot',
  'RigSetting',
  'Rig',
  'PendingUser',
  'StandbyDay',
  'OperatorAvailability',
  'TimeEntry',
  'PaymentRecord',
  'ShootReport',
  'RigTest',
  'ReferenceImage',
  'Report',
  'Event',
  'ShootNotification',
  'UserPresence',
  'RigCheckAssignment',
];

const DEMO_SETTING_KEYS = ['auto_assign_teams', 'auto_assign_users'];

function isDemoUser(row) {
  const email = String(row.email || '').toLowerCase();
  if (keepEmails.has(email)) return false;
  return email.endsWith('@example.com');
}

const users = db.prepare('SELECT id, email, role FROM users').all();
const demoUsers = users.filter(isDemoUser);
const keptUsers = users.filter((u) => !isDemoUser(u));

const counts = Object.fromEntries(
  WIPE_ENTITY_TYPES.map((type) => [
    type,
    db.prepare('SELECT COUNT(*) AS n FROM entities WHERE entity_type = ?').get(type).n,
  ])
);

console.log('Entities to delete:');
for (const [type, n] of Object.entries(counts)) {
  if (n > 0) console.log(`  ${type}: ${n}`);
}
console.log(`Demo users to delete: ${demoUsers.length}`);
demoUsers.forEach((u) => console.log(`  - ${u.email} (${u.role})`));
console.log(`Users kept: ${keptUsers.length}`);
keptUsers.forEach((u) => console.log(`  + ${u.email} (${u.role})`));

if (!keptUsers.some((u) => u.role === 'admin')) {
  console.error('\nRefusing to run: no admin account would remain.');
  console.error('Promote your real account to admin first, or pass KEEP_EMAILS=you@company.com');
  process.exit(1);
}

if (!confirm) {
  console.log('\nDry run. Re-run with --confirm to delete.');
  process.exit(0);
}

const run = db.transaction(() => {
  for (const type of WIPE_ENTITY_TYPES) {
    db.prepare('DELETE FROM entities WHERE entity_type = ?').run(type);
  }
  for (const u of demoUsers) {
    db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  }
  // Demo team lists would otherwise keep sample club names in auto-assign rules
  for (const key of DEMO_SETTING_KEYS) {
    db.prepare(
      "DELETE FROM entities WHERE entity_type = 'AppSettings' AND json_extract(data, '$.key') = ?"
    ).run(key);
  }

  const marker = db
    .prepare(
      "SELECT id FROM entities WHERE entity_type = 'AppSettings' AND json_extract(data, '$.key') = ?"
    )
    .get(DEMO_SEED_DISABLED_KEY);
  const ts = new Date().toISOString();
  const payload = JSON.stringify({
    key: DEMO_SEED_DISABLED_KEY,
    value: 'true',
    description: 'Demo seed data removed — do not re-seed',
  });
  if (marker) {
    db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?').run(payload, ts, marker.id);
  } else {
    db.prepare(
      'INSERT INTO entities (id, entity_type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)'
    ).run(
      `demoseed${Date.now().toString(36)}`,
      'AppSettings',
      payload,
      ts,
      ts
    );
  }
});

run();

console.log('\nDemo data removed. Restart the app so it reloads:');
console.log('  pm2 restart remote-ops --update-env');
