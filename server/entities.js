import { db, nowIso, newId, rowToEntity, ENTITY_TYPES } from './db.js';
import { listUsers, findUserById, updateUser } from './auth.js';
import { emitEntityChange } from './events.js';

function sortRecords(records, sort) {
  if (!sort) return records;
  const desc = String(sort).startsWith('-');
  const field = desc ? String(sort).slice(1) : String(sort);
  return [...records].sort((a, b) => {
    const av = a?.[field];
    const bv = b?.[field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

function matchesFilter(record, filter = {}) {
  return Object.entries(filter).every(([key, value]) => {
    if (value === undefined) return true;
    const recVal = record?.[key];
    if (Array.isArray(value)) {
      return value.some((v) => String(recVal) === String(v));
    }
    if (typeof value === 'boolean') {
      return Boolean(recVal) === value;
    }
    return String(recVal ?? '') === String(value);
  });
}

function assertKnownType(entityType) {
  if (entityType === 'User') return;
  if (!ENTITY_TYPES.includes(entityType)) {
    const err = new Error(`Unknown entity type: ${entityType}`);
    err.status = 404;
    throw err;
  }
}

export function listEntities(entityType, sort, limit) {
  assertKnownType(entityType);

  if (entityType === 'User') {
    let users = listUsers();
    users = sortRecords(users, sort || '-created_date');
    if (limit) users = users.slice(0, Number(limit));
    return users;
  }

  const rows = db.prepare('SELECT * FROM entities WHERE entity_type = ?').all(entityType);
  let records = rows.map(rowToEntity);
  records = sortRecords(records, sort || '-created_date');
  if (limit) records = records.slice(0, Number(limit));
  return records;
}

export function filterEntities(entityType, filter = {}, sort, limit) {
  const records = listEntities(entityType, sort, null).filter((r) => matchesFilter(r, filter));
  return limit ? records.slice(0, Number(limit)) : records;
}

export function getEntity(entityType, id) {
  assertKnownType(entityType);
  if (entityType === 'User') {
    const user = findUserById(id);
    return user ? listUsers().find((u) => u.id === id) : null;
  }
  const row = db.prepare('SELECT * FROM entities WHERE id = ? AND entity_type = ?').get(id, entityType);
  return row ? rowToEntity(row) : null;
}

export function createEntity(entityType, data = {}, user = null) {
  assertKnownType(entityType);

  if (entityType === 'User') {
    const err = new Error('Create users via /api/auth/register or invite');
    err.status = 400;
    throw err;
  }

  const id = newId();
  const ts = nowIso();
  const { id: _ignore, created_date, updated_date, created_by_id, ...payload } = data;
  db.prepare(`
    INSERT INTO entities (id, entity_type, data, created_date, updated_date, created_by_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, entityType, JSON.stringify(payload), ts, ts, user?.id || null);

  const created = getEntity(entityType, id);
  emitEntityChange(entityType, { type: 'create', data: created });
  return created;
}

export function updateEntity(entityType, id, data = {}) {
  assertKnownType(entityType);

  if (entityType === 'User') {
    const updated = updateUser(id, data);
    if (updated) emitEntityChange('User', { type: 'update', data: updated });
    return updated;
  }

  const existing = getEntity(entityType, id);
  if (!existing) return null;

  const { id: _i, created_date, updated_date, created_by_id, ...rest } = existing;
  const nextData = { ...rest, ...data };
  delete nextData.id;
  delete nextData.created_date;
  delete nextData.updated_date;
  delete nextData.created_by_id;

  const ts = nowIso();
  db.prepare(`
    UPDATE entities SET data = ?, updated_date = ? WHERE id = ? AND entity_type = ?
  `).run(JSON.stringify(nextData), ts, id, entityType);

  const updated = getEntity(entityType, id);
  emitEntityChange(entityType, { type: 'update', data: updated });
  return updated;
}

export function deleteEntity(entityType, id) {
  assertKnownType(entityType);
  if (entityType === 'User') {
    const err = new Error('Deleting users is not supported; mark inactive instead');
    err.status = 400;
    throw err;
  }

  const existing = getEntity(entityType, id);
  if (!existing) return false;
  db.prepare('DELETE FROM entities WHERE id = ? AND entity_type = ?').run(id, entityType);
  emitEntityChange(entityType, { type: 'delete', data: { id } });
  return true;
}
