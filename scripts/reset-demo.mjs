/**
 * Wipe SQLite DB and reseed users + demo ops data.
 * Usage: npm run seed:demo
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../server/data/remote-ops.db');

for (const p of [dbPath, `${dbPath}-shm`, `${dbPath}-wal`]) {
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

const { seedIfEmpty } = await import('../server/seed.js');
seedIfEmpty();
console.log('Fresh demo database ready at', dbPath);
console.log('Restart the API (`npm run dev`) if it is already running so it picks up the new database.');

