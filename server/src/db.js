import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = process.env.ROM_DB || path.join(dataDir, 'rom.db');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

export function withTransaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  }
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','operator','accounts','standby')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rigs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      team_name TEXT,
      venue_type TEXT,
      shoot_type TEXT DEFAULT 'Data',
      recipe_json TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shoots (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      team_name TEXT,
      opponent TEXT,
      date TEXT NOT NULL,
      setup_time TEXT,
      game_time TEXT NOT NULL DEFAULT '19:00',
      expected_end_time TEXT,
      venue TEXT,
      shoot_type TEXT DEFAULT 'Data',
      rig_id TEXT REFERENCES rigs(id),
      status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN (
          'scheduled','setup_started','setup_complete',
          'game_started','completed','cancelled'
        )),
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_shoots_date ON shoots(date);
    CREATE INDEX IF NOT EXISTS idx_shoots_status ON shoots(status);
    CREATE INDEX IF NOT EXISTS idx_shoots_team ON shoots(team_name);

    CREATE TABLE IF NOT EXISTS shoot_status_events (
      id TEXT PRIMARY KEY,
      shoot_id TEXT NOT NULL REFERENCES shoots(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      recorded_by TEXT NOT NULL REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_status_events_shoot ON shoot_status_events(shoot_id);

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      shoot_id TEXT NOT NULL REFERENCES shoots(id) ON DELETE CASCADE,
      operator_id TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL
        CHECK (status IN ('assigned','pending','rejected','withdrawn')),
      source TEXT NOT NULL DEFAULT 'self'
        CHECK (source IN ('self','admin','approval','auto_pair')),
      assignment_group_id TEXT,
      is_pre_approved INTEGER NOT NULL DEFAULT 0,
      is_additional INTEGER NOT NULL DEFAULT 0,
      assigned_by TEXT REFERENCES users(id),
      approved_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (shoot_id, operator_id)
    );
    CREATE INDEX IF NOT EXISTS idx_asg_operator ON assignments(operator_id);
    CREATE INDEX IF NOT EXISTS idx_asg_shoot ON assignments(shoot_id);
    CREATE INDEX IF NOT EXISTS idx_asg_status ON assignments(status);
    CREATE INDEX IF NOT EXISTS idx_asg_group ON assignments(assignment_group_id);
    CREATE INDEX IF NOT EXISTS idx_asg_pre ON assignments(is_pre_approved);

    CREATE TABLE IF NOT EXISTS assignment_audit (
      id TEXT PRIMARY KEY,
      shoot_id TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      action TEXT NOT NULL,
      performed_by TEXT NOT NULL,
      previous_state TEXT,
      new_state TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_shoot ON assignment_audit(shoot_id);
    CREATE INDEX IF NOT EXISTS idx_audit_operator ON assignment_audit(operator_id);

    CREATE TABLE IF NOT EXISTS operator_availability (
      id TEXT PRIMARY KEY,
      operator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      unavailable INTEGER NOT NULL DEFAULT 1,
      optional_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (operator_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_avail_date ON operator_availability(date);
    CREATE INDEX IF NOT EXISTS idx_avail_operator ON operator_availability(operator_id);

    CREATE TABLE IF NOT EXISTS payment_records (
      id TEXT PRIMARY KEY,
      operator_id TEXT NOT NULL REFERENCES users(id),
      period_month TEXT NOT NULL,
      amount REAL NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0,
      paid_date TEXT,
      note TEXT,
      base_rate_snapshot REAL,
      additional_rate_snapshot REAL,
      finalised_at TEXT,
      finalised_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (operator_id, period_month)
    );
    CREATE INDEX IF NOT EXISTS idx_pay_month ON payment_records(period_month);

    CREATE TABLE IF NOT EXISTS payment_line_overrides (
      id TEXT PRIMARY KEY,
      operator_id TEXT NOT NULL REFERENCES users(id),
      shoot_id TEXT NOT NULL REFERENCES shoots(id) ON DELETE CASCADE,
      period_month TEXT NOT NULL,
      fee_override REAL,
      is_additional_override INTEGER,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (operator_id, shoot_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_shoot_id TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(recipient_user_id, read);

    CREATE TABLE IF NOT EXISTS user_presence (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      last_seen TEXT NOT NULL,
      online INTEGER NOT NULL DEFAULT 1
    );
  `);

  // Map legacy role `user` → `operator` if any rows exist from earlier seeds
  try {
    db.prepare(`UPDATE users SET role = 'operator', updated_at = datetime('now') WHERE role = 'user'`).run();
  } catch {
    /* role check may reject — fine on fresh DB */
  }
}

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

export function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(key, JSON.stringify(value));
}

export function nowIso() {
  return new Date().toISOString();
}

export function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = String(timeStr).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function newId() {
  return crypto.randomUUID();
}
