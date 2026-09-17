/**
 * Import Base44 entity exports (CSV or JSON) into the database.
 *
 * Usage:
 *   node scripts/import-entities.mjs auto exports/*.csv              # dry run
 *   node scripts/import-entities.mjs auto exports/*.csv --confirm
 *   node scripts/import-entities.mjs Shoot Shoot_export.csv --confirm
 *
 * Admins can do the same thing from Settings → Import Data in the browser.
 * The parsing, type coercion, and upsert logic lives in server/entityImport.js.
 */
import fs from 'fs';
import path from 'path';
import { ENTITY_TYPES } from '../server/db.js';
import {
  importEntityRows,
  inferEntityType,
  parseFileContents,
  countBrokenShootReferences,
} from '../server/entityImport.js';

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const positional = args.filter((a) => !a.startsWith('--'));
const [typeArg, ...files] = positional;

if (!typeArg || files.length === 0) {
  console.error('Usage: node scripts/import-entities.mjs <EntityType|auto> <file.csv> [more files] [--confirm]');
  console.error(`Known types: ${ENTITY_TYPES.join(', ')}`);
  process.exit(1);
}

const targets = [];
for (const file of files) {
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }
  const entityType = typeArg === 'auto' ? inferEntityType(resolved) : typeArg;
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

// Shoots first so that shoot_id references in the other files resolve
targets.sort((a, b) => (a.entityType === 'Shoot' ? -1 : b.entityType === 'Shoot' ? 1 : 0));

let totalCreated = 0;
let totalUpdated = 0;

for (const { file, entityType } of targets) {
  const rows = parseFileContents(file, fs.readFileSync(file, 'utf8'));
  const result = importEntityRows({ entityType, rows, confirm });

  console.log(`${entityType.padEnd(20)} ${path.basename(file)}`);
  console.log(`  rows: ${result.rows}  ->  ${result.created} new, ${result.updated} existing`);
  if (result.skippedWithoutId) {
    console.log(`  skipped (no id column): ${result.skippedWithoutId}`);
  }
  if (result.unknownColumns.length) {
    console.log(`  columns not in the schema (type inferred): ${result.unknownColumns.join(', ')}`);
  }
  if (result.sample) {
    console.log(`  sample: ${JSON.stringify(result.sample).slice(0, 220)}`);
  }
  console.log();

  totalCreated += result.created;
  totalUpdated += result.updated;
}

if (!confirm) {
  console.log('Dry run. Re-run with --confirm to write these records.');
} else {
  const { references, broken } = countBrokenShootReferences();
  console.log(`Imported: ${totalCreated} created, ${totalUpdated} updated`);
  console.log(`Shoot references: ${references} (${broken} unresolved)`);
  if (broken) {
    console.log('Unresolved references point at shoots that no longer exist in the export.');
  }
  console.log('Restart the app: pm2 restart remote-ops --update-env');
}
