import { before, beforeEach, after } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function setupTestDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rom-test-'));
  const dbFile = path.join(dir, 'test.db');
  process.env.ROM_DB = dbFile;

  // Dynamic import after env set — callers must import modules after setupTestDb()
  return { dir, dbFile };
}

export async function loadDb() {
  const mod = await import('../src/db.js');
  mod.migrate();
  return mod;
}

export async function resetDb(dbMod) {
  dbMod.db.exec(`
    DELETE FROM payment_line_overrides;
    DELETE FROM payment_records;
    DELETE FROM notifications;
    DELETE FROM assignment_audit;
    DELETE FROM assignments;
    DELETE FROM shoot_status_events;
    DELETE FROM shoots;
    DELETE FROM operator_availability;
    DELETE FROM user_presence;
    DELETE FROM rigs;
    DELETE FROM settings;
    DELETE FROM users;
  `);
}

export function seedDefaults(dbMod, { hashPassword }) {
  const { db, setSetting, newId } = dbMod;
  const pw = hashPassword('rom123');

  const adminId = newId();
  const op1 = newId();
  const op2 = newId();
  const accountsId = newId();

  const insert = db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, role, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  insert.run(adminId, 'admin@rom.demo', pw, 'Alex Admin', 'admin');
  insert.run(op1, 'op1@rom.demo', pw, 'Jordan Operator', 'operator');
  insert.run(op2, 'op2@rom.demo', pw, 'Riley Cam', 'operator');
  insert.run(accountsId, 'accounts@rom.demo', pw, 'Casey Accounts', 'accounts');

  setSetting('base_rate', 1000);
  setSetting('additional_rate', 250);
  setSetting('currency', 'ZAR');
  setSetting('pre_approved_limit', 6);
  setSetting('auto_pair_teams', ['Reds', 'Red Sox', 'Rangers']);
  setSetting('auto_pair_window_minutes', 120);
  setSetting('application_name', 'Remote Ops Manager');

  return { adminId, op1, op2, accountsId };
}

export function makeShoot(dbMod, {
  id,
  title,
  teamName,
  date,
  gameTime = '19:00',
  status = 'scheduled',
  venue = 'Test Venue',
}) {
  const shootId = id || dbMod.newId();
  dbMod.db.prepare(`
    INSERT INTO shoots (
      id, title, team_name, opponent, date, setup_time, game_time,
      venue, shoot_type, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Data', ?, datetime('now'), datetime('now'))
  `).run(
    shootId,
    title,
    teamName,
    'Opponent',
    date,
    '16:30',
    gameTime,
    venue,
    status
  );
  return shootId;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(base, n) {
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
