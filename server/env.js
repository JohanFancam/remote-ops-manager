/**
 * Load key=value pairs from .env into process.env.
 *
 * Imported for its side effect before anything reads configuration, so a
 * plain `node server/index.js` (or PM2, which does not read .env) picks up
 * JWT_SECRET, DATABASE_PATH, Google, and VAPID settings.
 *
 * Real environment variables always win, matching dotenv's behaviour.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function stripQuotes(value) {
  const trimmed = value.trim();
  const quoted = /^(['"])(.*)\1$/s.exec(trimmed);
  return quoted ? quoted[2] : trimmed;
}

export function loadEnvFile(file = process.env.ENV_FILE || path.resolve(__dirname, '../.env')) {
  let contents;
  try {
    contents = fs.readFileSync(file, 'utf8');
  } catch {
    return { loaded: false, applied: 0 };
  }

  let applied = 0;
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const withoutExport = line.startsWith('export ') ? line.slice(7) : line;
    const eq = withoutExport.indexOf('=');
    if (eq < 1) continue;

    const key = withoutExport.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;

    const value = stripQuotes(withoutExport.slice(eq + 1));
    if (value === '') continue;

    process.env[key] = value;
    applied += 1;
  }

  return { loaded: true, applied };
}

loadEnvFile();
