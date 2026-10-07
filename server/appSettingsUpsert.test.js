import { createEntity, deleteEntity, listEntities } from './entities.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const key = `test_logo_upsert_${Date.now()}`;
let id = null;

try {
  const first = createEntity('AppSettings', { key, value: '/uploads/one.png', description: 'test logo upsert' });
  id = first.id;
  const second = createEntity('AppSettings', { key, value: '/api/uploads/two.png', description: 'test logo upsert' });
  assert(second.id === first.id, 'creating the same AppSettings key updates the existing row');
  assert(second.value === '/api/uploads/two.png', 'upsert writes the new value');
  const matches = listEntities('AppSettings').filter((row) => row.key === key);
  assert(matches.length === 1, 'duplicate app_logo keys are not created');
  console.log('appSettings upsert ok');
} finally {
  if (id) deleteEntity('AppSettings', id);
}
