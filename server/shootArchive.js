/**
 * Full-shoot snapshots written before Google sync removes a row.
 * Restore reads this file plus notifications / lastSyncChanges.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_ARCHIVED = 500;

function archivePath() {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'remote-ops.db');
  return path.join(path.dirname(dbPath), 'deleted-shoots.json');
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function readDeletedShootArchive() {
  const raw = readJson(archivePath(), []);
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.shoots)) return raw.shoots;
  return [];
}

export function archiveDeletedShoot(shoot, reason = 'deleted') {
  if (!shoot?.id) return null;
  const entry = {
    archived_at: new Date().toISOString(),
    reason,
    shoot: { ...shoot },
  };
  const list = readDeletedShootArchive().filter((item) => item?.shoot?.id !== shoot.id);
  list.unshift(entry);
  fs.mkdirSync(path.dirname(archivePath()), { recursive: true });
  fs.writeFileSync(archivePath(), JSON.stringify(list.slice(0, MAX_ARCHIVED), null, 2));
  return entry;
}

export function shootHasPeople(shoot) {
  if (!shoot) return false;
  const assigned = Array.isArray(shoot.assigned_operators) && shoot.assigned_operators.length;
  const pending = Array.isArray(shoot.pending_operators) && shoot.pending_operators.length;
  return Boolean(assigned || pending);
}
