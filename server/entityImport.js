/**
 * Shared Base44 export import logic, used by scripts/import-entities.mjs and
 * the admin import endpoints.
 *
 * CSV delivers every field as text, and the string "false" is truthy, so values
 * are coerced from each entity's schema (with inference for columns that predate
 * it). Original ids are preserved so cross-references such as
 * PaymentRecord.shoot_id keep resolving, and re-imports upsert by id.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, nowIso, ENTITY_TYPES } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaDir = path.resolve(__dirname, 'schemas');

/** Base44 bookkeeping columns with no meaning here */
export const IGNORED_COLUMNS = new Set(['created_by_id', 'created_by', 'is_sample']);
const RESERVED_COLUMNS = ['id', 'created_date', 'updated_date'];

const schemaCache = new Map();

export function loadSchemaProperties(entityType) {
  if (schemaCache.has(entityType)) return schemaCache.get(entityType);
  const file = path.join(schemaDir, `${entityType}.jsonc`);
  let properties = {};
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, '');
    try {
      properties = JSON.parse(raw).properties || {};
    } catch {
      properties = {};
    }
  }
  schemaCache.set(entityType, properties);
  return properties;
}

/** "Shoot_export_1234.csv" -> "Shoot" */
export function inferEntityType(fileName) {
  const base = path.basename(fileName).replace(/\.(csv|json)$/i, '');
  const candidate = base.split(/[_\-. ]/)[0];
  return ENTITY_TYPES.find((t) => t.toLowerCase() === candidate.toLowerCase()) || null;
}

export function splitCsvLine(line) {
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

/** Cells may contain newlines inside quotes (Slack messages, notes) */
export function parseCsv(text) {
  const rows = [];
  let buffer = '';
  let quotes = 0;
  for (const raw of text.split(/\r?\n/)) {
    buffer = buffer ? `${buffer}\n${raw}` : raw;
    quotes += (raw.match(/"/g) || []).length;
    if (quotes % 2 === 0) {
      if (buffer.trim()) rows.push(buffer);
      buffer = '';
      quotes = 0;
    }
  }
  if (buffer.trim()) rows.push(buffer);
  if (!rows.length) return [];

  const headers = splitCsvLine(rows[0]).map((h) => h.trim().replace(/^"|"$/g, ''));
  return rows.slice(1).map((row) => {
    const cells = splitCsvLine(row);
    return Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()]));
  });
}

/** Clean numeric literal; leading zeros are left alone in case they are codes */
const NUMERIC = /^-?(0|[1-9]\d*)(\.\d+)?$/;

function parseJsonish(value) {
  const trimmed = String(value).trim();
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

/**
 * Exports carry fields that predate this app's schemas (rig_check_completed,
 * live_data, ...). Leaving those as text is dangerous: "false" is truthy, so
 * `!!shoot.rig_check_completed` would report every shoot as checked.
 */
function inferType(value) {
  const trimmed = String(value).trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  if (lower === 'null') return undefined;

  const parsed = parseJsonish(trimmed);
  if (parsed !== undefined) return parsed;

  if (NUMERIC.test(trimmed)) return Number(trimmed);
  return trimmed;
}

export function coerce(value, spec) {
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
    const parsed = parseJsonish(value);
    if (parsed !== undefined) return parsed;
    if (type === 'array') return String(value).trim().split(',').map((v) => v.trim()).filter(Boolean);
    return undefined;
  }
  if (type === 'string') return String(value);

  return inferType(value);
}

function buildRecord(row, properties) {
  const data = {};
  for (const [key, raw] of Object.entries(row)) {
    if (IGNORED_COLUMNS.has(key) || RESERVED_COLUMNS.includes(key)) continue;
    const value = coerce(raw, properties[key]);
    if (value !== undefined) data[key] = value;
  }
  return data;
}

/**
 * Analyse rows for an entity type, and write them when confirm is true.
 * Returns a summary suitable for showing in a preview.
 */
export function importEntityRows({ entityType, rows, confirm = false, user = null }) {
  if (!ENTITY_TYPES.includes(entityType)) {
    const err = new Error(`Unknown entity type: ${entityType}`);
    err.status = 400;
    throw err;
  }

  const properties = loadSchemaProperties(entityType);
  const existingIds = new Set(
    db.prepare('SELECT id FROM entities WHERE entity_type = ?').all(entityType).map((r) => r.id)
  );

  const prepared = [];
  const unknownColumns = new Set();
  let skippedWithoutId = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    for (const key of Object.keys(row)) {
      if (IGNORED_COLUMNS.has(key) || RESERVED_COLUMNS.includes(key)) continue;
      if (!properties[key]) unknownColumns.add(key);
    }

    const id = String(row.id || '').trim();
    if (!id) {
      skippedWithoutId += 1;
      continue;
    }
    prepared.push({
      id,
      data: buildRecord(row, properties),
      created: String(row.created_date || '').trim() || nowIso(),
      updated: String(row.updated_date || '').trim() || nowIso(),
    });
  }

  const created = prepared.filter((r) => !existingIds.has(r.id)).length;
  const updated = prepared.length - created;

  if (confirm && prepared.length) {
    const write = db.transaction(() => {
      const insert = db.prepare(
        'INSERT INTO entities (id, entity_type, data, created_date, updated_date, created_by_id) VALUES (?, ?, ?, ?, ?, ?)'
      );
      const replace = db.prepare(
        'UPDATE entities SET data = ?, updated_date = ? WHERE id = ? AND entity_type = ?'
      );
      for (const row of prepared) {
        const json = JSON.stringify(row.data);
        if (existingIds.has(row.id)) {
          replace.run(json, row.updated, row.id, entityType);
        } else {
          insert.run(row.id, entityType, json, row.created, row.updated, user?.id || null);
        }
      }
    });
    write();
  }

  return {
    entityType,
    rows: prepared.length,
    created,
    updated,
    skippedWithoutId,
    unknownColumns: [...unknownColumns],
    sample: prepared[0]?.data || null,
    written: !!confirm,
  };
}

/** Count references that do not resolve, so a preview can warn about ordering */
export function countBrokenShootReferences() {
  const shootIds = new Set(
    db.prepare("SELECT id FROM entities WHERE entity_type = 'Shoot'").all().map((r) => r.id)
  );
  let references = 0;
  let broken = 0;
  for (const type of ['PaymentRecord', 'ShootReport', 'TimeEntry']) {
    for (const row of db.prepare('SELECT data FROM entities WHERE entity_type = ?').all(type)) {
      const id = JSON.parse(row.data).shoot_id;
      if (!id) continue;
      references += 1;
      if (!shootIds.has(id)) broken += 1;
    }
  }
  return { references, broken };
}

export function parseFileContents(fileName, text) {
  if (fileName.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  }
  return parseCsv(text);
}
