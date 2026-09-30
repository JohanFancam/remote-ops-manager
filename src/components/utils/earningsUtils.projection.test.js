import {
  DEFAULT_ADDITIONAL_RATE,
  DEFAULT_BASE_RATE,
  DEFAULT_POSTPONED_RATE,
  feeForProjectedShoot,
  isAwaitingApproval,
  mergeAssignedWithPending,
  operatorAssignedCost,
  operatorProjectedCost,
} from './earningsCost.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const rates = {
  baseRate: DEFAULT_BASE_RATE,
  additionalRate: DEFAULT_ADDITIONAL_RATE,
  postponedRate: DEFAULT_POSTPONED_RATE,
};

const assigned = {
  id: 'a1',
  date: '2026-09-30',
  game_time: '18:00',
  status: 'upcoming',
  assigned_operators: ['maya.chen@example.com'],
};

const pendingNear = {
  id: 'p1',
  date: '2026-09-30',
  game_time: '19:30',
  status: 'upcoming',
  pending_operators: ['maya.chen@example.com'],
};

const pendingAlone = {
  id: 'p2',
  date: '2026-10-01',
  game_time: '19:00',
  status: 'upcoming',
  pending_operators: ['maya.chen@example.com'],
};

const cancelledPending = {
  id: 'p3',
  date: '2026-09-30',
  game_time: '21:00',
  status: 'cancelled',
  pending_operators: ['maya.chen@example.com'],
};

assert(isAwaitingApproval(pendingNear), 'upcoming pending awaits approval');
assert(!isAwaitingApproval(cancelledPending), 'cancelled pending is not awaiting');
assert(!isAwaitingApproval(assigned), 'assigned-only is not awaiting');

const merged = mergeAssignedWithPending([assigned], [pendingNear, assigned]);
assert(merged.length === 2, 'merge de-dupes assigned + pending');
assert(merged.some((s) => s.id === 'p1'), 'pending included in merge');

const current = operatorAssignedCost([assigned], [], rates);
assert(current.total === DEFAULT_BASE_RATE, 'assigned shoot is base rate');

const near = operatorProjectedCost([assigned], [pendingNear], [], rates);
assert(near.current === DEFAULT_BASE_RATE, 'projection keeps confirmed total');
assert(near.pendingAdd === DEFAULT_ADDITIONAL_RATE, 'nearby pending becomes additional');
assert(near.projected === DEFAULT_BASE_RATE + DEFAULT_ADDITIONAL_RATE, 'projected = confirmed + additional');
assert(near.autoAdditionalIds.has('p1'), 'pending id marked additional');
assert(feeForProjectedShoot(pendingNear, [], near.autoAdditionalIds, rates) === DEFAULT_ADDITIONAL_RATE, 'listed pending fee is additional');

const alone = operatorProjectedCost([assigned], [pendingAlone], [], rates);
assert(alone.pendingAdd === DEFAULT_BASE_RATE, 'far pending is a full base fee');
assert(alone.projected === DEFAULT_BASE_RATE * 2, 'two main shoots');

const pendingOnly = operatorProjectedCost([], [pendingAlone], [], rates);
assert(pendingOnly.current === 0, 'no assigned cost yet');
assert(pendingOnly.projected === DEFAULT_BASE_RATE, 'pending-only operator still projects');

const postponed = operatorProjectedCost([assigned], [{
  id: 'p4',
  date: '2026-09-30',
  game_time: '19:30',
  status: 'postponed',
  pending_operators: ['maya.chen@example.com'],
}], [], rates);
assert(postponed.pendingAdd === DEFAULT_POSTPONED_RATE, 'postponed pending uses postponed rate');

console.log('earningsUtils.projection.test.js: ok');
