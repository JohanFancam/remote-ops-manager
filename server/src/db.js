import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = process.env.CUEBOARD_DB || path.join(dataDir, 'cueboard.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','standby','accounts','user')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shoots (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      client TEXT,
      location TEXT,
      date TEXT NOT NULL,
      game_time TEXT NOT NULL DEFAULT '19:00',
      setup_offset INTEGER NOT NULL DEFAULT -150,
      pre_shoot_offset INTEGER NOT NULL DEFAULT -120,
      attention_offset INTEGER NOT NULL DEFAULT -30,
      sound_offset INTEGER NOT NULL DEFAULT -30,
      status TEXT NOT NULL DEFAULT 'upcoming'
        CHECK (status IN ('upcoming','confirmed','in_progress','completed','cancelled')),
      rig_type_override TEXT,
      rate REAL,
      rate_type TEXT DEFAULT 'day_rate',
      notes TEXT,
      standby_admin TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_shoots_date ON shoots(date);
    CREATE INDEX IF NOT EXISTS idx_shoots_status ON shoots(status);
    CREATE INDEX IF NOT EXISTS idx_shoots_client ON shoots(client);

    CREATE TABLE IF NOT EXISTS shoot_assignments (
      id TEXT PRIMARY KEY,
      shoot_id TEXT NOT NULL REFERENCES shoots(id) ON DELETE CASCADE,
      operator_email TEXT NOT NULL COLLATE NOCASE,
      state TEXT NOT NULL CHECK (state IN ('pending','assigned','pre_approved')),
      auto_paired INTEGER NOT NULL DEFAULT 0,
      paired_shoot_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (shoot_id, operator_email, state)
    );
    CREATE INDEX IF NOT EXISTS idx_assignments_email ON shoot_assignments(operator_email);
    CREATE INDEX IF NOT EXISTS idx_assignments_shoot ON shoot_assignments(shoot_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_state ON shoot_assignments(state);

    CREATE TABLE IF NOT EXISTS shoot_phases (
      shoot_id TEXT NOT NULL REFERENCES shoots(id) ON DELETE CASCADE,
      phase TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      completed_by TEXT NOT NULL,
      PRIMARY KEY (shoot_id, phase)
    );

    CREATE TABLE IF NOT EXISTS rig_settings (
      id TEXT PRIMARY KEY,
      team TEXT NOT NULL UNIQUE COLLATE NOCASE,
      venue_type TEXT DEFAULT 'Indoor',
      sport TEXT,
      rig_type TEXT DEFAULT 'Data',
      shoot_plan TEXT,
      remote_rigs TEXT,
      data_enabled INTEGER DEFAULT 1,
      data_hd TEXT,
      data_wide_enabled INTEGER DEFAULT 1,
      data_wide TEXT,
      attention_enabled INTEGER DEFAULT 0,
      attention_hd TEXT,
      sound_enabled INTEGER DEFAULT 0,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS standby_windows (
      id TEXT PRIMARY KEY,
      start_date TEXT NOT NULL,
      start_time TEXT DEFAULT '08:00',
      end_date TEXT NOT NULL,
      end_time TEXT DEFAULT '08:00',
      admin_email TEXT NOT NULL COLLATE NOCASE,
      admin_name TEXT,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_standby_dates ON standby_windows(start_date, end_date);

    CREATE TABLE IF NOT EXISTS rig_tests (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      due_date TEXT,
      assigned_to TEXT COLLATE NOCASE,
      assigned_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','in_progress','completed')),
      completed_at TEXT,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_rig_tests_date ON rig_tests(scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_rig_tests_status ON rig_tests(status);

    CREATE TABLE IF NOT EXISTS pay_records (
      id TEXT PRIMARY KEY,
      operator_email TEXT NOT NULL COLLATE NOCASE,
      operator_name TEXT,
      period_month TEXT NOT NULL,
      shoot_id TEXT NOT NULL REFERENCES shoots(id) ON DELETE CASCADE,
      shoot_title TEXT,
      shoot_date TEXT NOT NULL,
      is_additional INTEGER NOT NULL DEFAULT 0,
      base_fee REAL NOT NULL,
      override_fee REAL,
      paid INTEGER NOT NULL DEFAULT 0,
      paid_date TEXT,
      notes TEXT,
      UNIQUE (operator_email, shoot_id)
    );
    CREATE INDEX IF NOT EXISTS idx_pay_period ON pay_records(period_month);
    CREATE INDEX IF NOT EXISTS idx_pay_operator ON pay_records(operator_email);
    CREATE INDEX IF NOT EXISTS idx_pay_paid ON pay_records(paid);
  `);
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
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, JSON.stringify(value));
}

/** Run fn inside a SQLite transaction (node:sqlite has no db.transaction). */
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
