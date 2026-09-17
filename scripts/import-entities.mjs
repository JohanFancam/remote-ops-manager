/**
 * Import Base44 entity exports (CSV or JSON) into the local database.
 *
 * Usage:
 *   node scripts/import-entities.mjs Shoot Shoot_export.csv              # dry run
 *   node scripts/import-entities.mjs Shoot Shoot_export.csv --confirm
 *   node scripts/import-entities.mjs auto exports/*.csv --confirm        # type from filename
 *
 * Why this exists rather than POSTing to /api/entities:
 *  - CSV values arrive as strings, so "false" would be stored as a truthy
 *    string and a fee of "500" as text. Types are coerced from the schema.
 *  - Original ids are preserved so cross-references such as PaymentRecord.shoot_id
 *    keep pointing at the right Shoot.
 *  - Re-running updates rows by id instead of duplicating them.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, nowIso, ENTITY_TYPES } from '../server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaDir = path.resolve(__dirname, '../server/schemas');

// Base44 bookkeeping columns that have no meaning here
const IGNORED_COLUMNS = new Set(['created_by_id', 'created_by', 'is_sample']);

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const positional = args.filter((a) => !a.startsWith('--'));
const [typeArg, ...files] = positional;

if (!typeArg || files.length === 0) {
  console.error('Usage: node scripts/import-entities.mjs <EntityType|auto> <file.csv> [more files] [--confirm]');
  console.error(`Known types: ${ENTITY_TYPES.join(', ')}`);
  process.exit(1);
}

function loadSchema(entityType) {
  const file = path.join(schemaDir, `${entityType}.jsonc`);
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  try {
    return JSON.parse(raw).properties || {};
  } catch {
    console.warn(`Could not parse schema for ${entityType}; importing values as text.`);
    return {};
  }
}

/** "Shoot_export_1234.csv" -> "Shoot" */
function typeFromFilename(file) {
  const base = path.basename(file).replace(/\.(csv|json)$/i, '');
  const candidate = base.split('_')[0];
  return ENTITY_TYPES.find((t) => t.toLowerCase() === candidate.toLowerCase()) || null;
}

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
  return cells;
}

/** CSV rows may contain newlines inside quoted cells */
function parseCsv(text) {
  const rows = [];
  let line = '';
  let quotes = 0;
  for (const raw of text.split(/\r?\n/)) {
    line = line ? `${line}\n${raw}` : raw;
    quotes += (raw.match(/"/g) || []).length;
    if (quotes % 2 === 0) {
      if (line.trim()) rows.push(line);
      line = '';
      quotes = 0;
    }
  }
  if (line.trim()) rows.push(line);
  if (!rows.length) return [];

  const headers = splitCsvLine(rows[0]).map((h) => h.trim().replace(/^"|"$/g, ''));
  return rows.slice(1).map((row) => {
    const cells = splitCsvLine(row);
    return Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()]));
  });
}

function coerce(value, spec) {
  if (value === undefined || value === null || value === '') return undefined;
  const type = spec?.type;

  if (type === 'boolean') {
    return ['true', '1', 'yes', 'y'].includes(String(value).trim().toLowerCase());
  }
  if (type === 'number') {
    const n = Number(String(value).replace(/[^0-9.eE+-]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  if (type === 'array' || type === 'object') {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // fall through to comma splitting
      }
    }
    if (type === 'array') return trimmed.split(',').map((v) => v.trim()).filter(Boolean);
    return undefined;
  }
  return String(value);
}

function buildRecord(row, properties) {
  const data = {};
  for (const [key, raw] of Object.entries(row)) {
    if (IGNORED_COLUMNS.has(key)) continue;
    if (['id', 'created_date', 'updated_date'].includes(key)) continue;
    const coerced = coerce(raw, properties[key]);
    if (coerced !== undefined) data[key] = coerced;
  }
  return data;
}

const targets = [];
for (const file of files) {
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }
  const entityType = typeArg === 'auto' ? typeFromFilename(resolved) : typeArg;
  if (!entityType) {
    console.error(`Could not infer entity type from ${path.basename(resolved)}; pass it explicitly.`);
    process.exit(1);
  }
  if (!ENTITY_TYPES.includes(entityType)) {
    console.error(`Unknown entity type "${entityType}". Known: ${ENTITY_TYPES.join(', ')}`);
    process.exit(1);
  }
  targets.push({ file: resolved, entityType });
}

let totalCreated = 0;
let totalUpdated = 0;

for (const { file, entityType } of targets) {
  const properties = loadSchema(entityType);
  const raw = fs.readFileSync(file, 'utf8');
  const rows = file.endsWith('.json') ? JSON.parse(raw) : parseCsv(raw);

  const existingIds = new Set(
    db.prepare('SELECT id FROM entities WHERE entity_type = ?').all(entityType).map((r) => r.id)
  );

  let create = 0;
  let update = 0;
  const prepared = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const id = String(row.id || '').trim();
    if (!id) continue;
    prepared.push({
      id,
      data: buildRecord(row, properties),
      created: String(row.created_date || '').trim() || nowIso(),
      updated: String(row.updated_date || '').trim() || nowIso(),
    });
    if (existingIds.has(id)) update += 1; else create += 1;
  }

  console.log(`${entityType.padEnd(20)} ${path.basename(file)}`);
  console.log(`  rows: ${prepared.length}  ->  ${create} new, ${update} existing`);

  const unknown = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const key of Object.keys(row)) {
      if (IGNORED_COLUMNS.has(key)) continue;
      if (['id', 'created_date', 'updated_date'].includes(key)) continue;
      if (!properties[key]) unknown.add(key);
    }
  }
  if (unknown.size) {
    console.log(`  columns not in the schema (kept as text): ${[...unknown].join(', ')}`);
  }
  if (prepared[0]) {
    console.log(`  sample: ${JSON.stringify(prepared[0].data).slice(0, 220)}`);
  }

  if (confirm) {
    const write = db.transaction(() => {
      const insert = db.prepare(
        'INSERT INTO entities (id, entity_type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)'
      );
      const replace = db.prepare(
        'UPDATE entities SET data = ?, updated_date = ? WHERE id = ? AND entity_type = ?'
      );
      for (const row of prepared) {
        const json = JSON.stringify(row.data);
        if (existingIds.has(row.id)) {
          replace.run(json, row.updated, row.id, entityType);
        } else {
          insert.run(row.id, entityType, json, row.created, row.updated);
        }
      }
    });
    write();
    totalCreated += create;
    totalUpdated += update;
  }
  console.log();
}

if (!confirm) {
  console.log('Dry run. Re-run with --confirm to write these records.');
} else {
  console.log(`Imported: ${totalCreated} created, ${totalUpdated} updated`);
  console.log('Restart the app: pm2 restart remote-ops --update-env');
}
