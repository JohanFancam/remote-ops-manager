import { isPendingCompletePay, isShootReportedComplete } from './earningsCost.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const assigned = {
  id: 's1',
  date: '2026-10-08',
  game_time: '19:00',
  status: 'upcoming',
  assigned_operators: ['op@example.com'],
};

assert(!isShootReportedComplete(assigned), 'upcoming is not reported complete');
assert(isPendingCompletePay(assigned), 'upcoming pay stays pending');
assert(isShootReportedComplete({ ...assigned, phase_status: { shoot_complete: '2026-10-08T21:00:00.000Z' } }), 'shoot_complete reports done');
assert(!isPendingCompletePay({ ...assigned, phase_status: { shoot_complete: '2026-10-08T21:00:00.000Z' } }), 'reported shoot leaves pending');
assert(!isPendingCompletePay({ ...assigned, status: 'completed' }), 'completed status leaves pending');
assert(!isPendingCompletePay({ ...assigned, status: 'cancelled' }), 'cancelled is not pending pay');
assert(!isPendingCompletePay({ ...assigned, status: 'postponed' }), 'postponed is not pending pay');

console.log('earningsUtils.complete.test.js: ok');
