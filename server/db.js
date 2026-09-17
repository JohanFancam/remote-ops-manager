import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'remote-ops.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT DEFAULT '',
    role TEXT DEFAULT 'user',
    standby INTEGER DEFAULT 0,
    inactive INTEGER DEFAULT 0,
    data TEXT DEFAULT '{}',
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    data TEXT NOT NULL,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    created_by_id TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
  CREATE INDEX IF NOT EXISTS idx_entities_type_created ON entities(entity_type, created_date);
`);

export function nowIso() {
  return new Date().toISOString();
}

export function newId() {
  return randomUUID().replace(/-/g, '');
}

export function parseJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function publicUser(row) {
  if (!row) return null;
  const extra = parseJson(row.data, {});
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name || '',
    role: row.role || 'user',
    standby: !!row.standby,
    inactive: !!row.inactive,
    created_date: row.created_date,
    updated_date: row.updated_date,
    ...extra,
  };
}

export function rowToEntity(row) {
  const data = parseJson(row.data, {});
  return {
    id: row.id,
    created_date: row.created_date,
    updated_date: row.updated_date,
    created_by_id: row.created_by_id || null,
    ...data,
  };
}

export const ENTITY_TYPES = [
  'Shoot',
  'RigSetting',
  'Rig',
  'PendingUser',
  'AppSettings',
  'UserPresence',
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
  'PushSubscription',
];
