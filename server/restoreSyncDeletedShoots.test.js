import {
  collectDeletedShootHints,
  findLivingMatch,
  recoverAssigneesFromNotifications,
} from './restoreSyncDeletedShoots.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const notes = [
  {
    type: 'assigned',
    shoot_id: 's1',
    shoot_title: 'Current vs Pride',
    shoot_date: '2026-09-12',
    target_user_email: 'priya@example.com',
    created_at: '2026-09-10T10:00:00.000Z',
  },
  {
    type: 'unassigned',
    shoot_id: 's1',
    shoot_title: 'Current vs Pride',
    shoot_date: '2026-09-12',
    target_user_email: 'priya@example.com',
    created_at: '2026-09-10T11:00:00.000Z',
  },
  {
    type: 'assigned',
    shoot_id: 's1',
    shoot_title: 'Current vs Pride',
    shoot_date: '2026-09-12',
    target_user_email: 'sam@example.com',
    created_at: '2026-09-10T12:00:00.000Z',
  },
  {
    type: 'google_sync',
    title: 'Shoot removed from calendar',
    notification_key: 'google_sync_delete:s1:2026-09-29T20:00:00.000Z',
    shoot_id: 's1',
    shoot_title: 'Current vs Pride',
    shoot_date: '2026-09-12',
    shoot_time: '19:00',
    created_at: '2026-09-29T20:00:00.000Z',
  },
];

const recovered = recoverAssigneesFromNotifications(notes, {
  shootId: 's1',
  title: 'Kansas City Current vs Pride',
  date: '2026-09-12',
});
assert(recovered.length === 1 && recovered[0] === 'sam@example.com', `assignees ${recovered}`);

const extras = recoverAssigneesFromNotifications([
  {
    type: 'google_sync',
    shoot_id: 's2',
    shoot_title: 'Charlotte vs Union',
    shoot_date: '2026-09-20',
    assigned_operators: ['lee@example.com'],
  },
], { shootId: 's2', title: 'Charlotte FC vs Union', date: '2026-09-20' });
assert(extras[0] === 'lee@example.com', 'snapshot extras win');

const hints = collectDeletedShootHints({
  lastSyncChanges: [
    { action: 'deleted', title: 'Current vs Pride', date: '2026-09-12', time: '19:00', calendar: 'Data' },
    { action: 'created', title: 'Other', date: '2026-09-13', time: '18:00' },
  ],
  notifications: notes,
  archive: [{
    shoot: {
      id: 's9',
      title: 'Jets vs Twins',
      date: '2026-09-18',
      game_time: '20:00',
      assigned_operators: ['pat@example.com'],
    },
  }],
});
assert(hints.some((hint) => hint.title === 'Current vs Pride'), 'delete change collected');
assert(hints.some((hint) => hint.shootId === 's1'), 'delete notification collected');
assert(hints.some((hint) => hint.shootId === 's9' && hint.assigned[0] === 'pat@example.com'), 'archive collected');
assert(!hints.some((hint) => hint.title === 'Other'), 'creates are ignored');

const living = findLivingMatch(
  [{ id: 'keep', title: 'KC Current vs Pride', date: '2026-09-12', game_time: '19:00' }],
  { title: 'Current vs Pride', date: '2026-09-12', time: '19:00' }
);
assert(living?.id === 'keep', 'living alias match');

assert(
  !findLivingMatch(
    [{ id: 'other', title: 'Current vs Gotham', date: '2026-09-12' }],
    { title: 'Current vs Pride', date: '2026-09-12' }
  ),
  'different opponent is not a match'
);

console.log('restoreSyncDeletedShoots tests passed');
