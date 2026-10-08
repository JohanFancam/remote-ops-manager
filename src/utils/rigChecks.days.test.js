import { groupRigChecksByDay, RIG_CHECK_DAYS_PER_PAGE } from './rigChecks.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const groups = groupRigChecksByDay([
  { id: '1', due_date: '2026-10-10', team: 'Lakers', status: 'pending' },
  { id: '2', due_date: '2026-10-08', team: 'Celtics', status: 'completed' },
  { id: '3', shoot_date: '2026-10-10', team: 'Knicks', status: 'pending' },
  { id: '4', due_date: '2026-10-12', team: 'Warriors', status: 'pending' },
], '2026-10-10');

assert(groups[0].day === '2026-10-10', 'today/upcoming first');
assert(groups[0].rows.length === 2, 'same day grouped');
assert(groups[1].day === '2026-10-12', 'later upcoming next');
assert(groups[2].day === '2026-10-08', 'past days after upcoming');
assert(RIG_CHECK_DAYS_PER_PAGE === 4, 'page size is 4 days');

console.log('rigChecks.days tests passed');
