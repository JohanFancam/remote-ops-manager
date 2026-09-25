import {
  canonicalTeamName,
  findAliasDateMatch,
  isManualShootTitle,
  isAssignmentLocked,
  matchupKey,
  resolveExistingShoot,
  titlesAreEquivalent,
} from './shootTitleMatch.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(canonicalTeamName('Kansas City Current') === 'current', 'kc current alias');
assert(canonicalTeamName('KC Current') === 'current', 'kc short alias');
assert(canonicalTeamName('Current') === 'current', 'current alias');
assert(canonicalTeamName('Charlotte FC') === 'charlotte', 'charlotte fc alias');
assert(canonicalTeamName('Charlotte') === 'charlotte', 'charlotte alias');
assert(canonicalTeamName('Pride') === 'pride', 'other team unchanged');

assert(
  matchupKey('Kansas City Current vs Pride', '2026-09-12')
    === matchupKey('Current vs Pride', '2026-09-12'),
  'current vs pride key'
);
assert(
  matchupKey('KC Current vs Gotham', '2026-09-12')
    === matchupKey('Current vs Gotham', '2026-09-12'),
  'kc current vs gotham'
);
assert(
  matchupKey('Charlotte FC vs Union', '2026-09-20')
    === matchupKey('Charlotte vs Union', '2026-09-20'),
  'charlotte fc vs union'
);
assert(titlesAreEquivalent('Kansas City Current vs Pride', 'Current vs Pride'), 'titles equivalent');
assert(!titlesAreEquivalent('Current vs Pride', 'Current vs Gotham'), 'different opponent');

assert(isManualShootTitle('NWSL photo manual'), 'manual word');
assert(isManualShootTitle('Manual — Lady Gaga'), 'manual start');
assert(!isManualShootTitle('Current vs Pride'), 'not manual');
assert(isAssignmentLocked({ title: 'Concert Manual' }), 'locked by title');
assert(isAssignmentLocked({ title: 'Current vs Pride', assignment_locked: true }), 'locked by flag');
assert(!isAssignmentLocked({ title: 'Current vs Pride' }), 'not locked');

const existing = [
  { id: 'app-1', title: 'Current vs Pride', date: '2026-09-12' },
  { id: 'app-2', title: 'Charlotte vs Union', date: '2026-09-20', google_calendar_id: 'data' },
  { id: 'linked', title: 'Current vs Gotham', date: '2026-09-15', google_event_id: 'g1' },
];

const currentHit = findAliasDateMatch(existing, 'Kansas City Current vs Pride', '2026-09-12', 'data');
assert(currentHit?.id === 'app-1', `current match ${currentHit?.id}`);

const charlotteHit = findAliasDateMatch(existing, 'Charlotte FC vs Union', '2026-09-20', 'data');
assert(charlotteHit?.id === 'app-2', `charlotte match ${charlotteHit?.id}`);

const skipLinked = findAliasDateMatch(existing, 'Kansas City Current vs Gotham', '2026-09-15', 'data');
assert(!skipLinked, 'do not steal a shoot already linked to Google');

const moved = findAliasDateMatch(
  [{ id: 'near', title: 'KC Current vs Pride', date: '2026-09-11' }],
  'Kansas City Current vs Pride',
  '2026-09-12',
  'data'
);
assert(moved?.id === 'near', 'unique nearby alias updates date instead of creating');

const resolved = resolveExistingShoot(
  { id: 'g-dup', title: 'Kansas City Current vs Pride', google_event_id: 'evt-1' },
  { id: 'app-1', title: 'Current vs Pride' }
);
assert(resolved.keep?.id === 'app-1', 'prefer app shoot over Google recreation');
assert(resolved.retire?.id === 'g-dup', 'retire Google-titled duplicate');

const onlyLinked = resolveExistingShoot({ id: 'g1', google_event_id: 'e' }, null);
assert(onlyLinked.keep?.id === 'g1' && !onlyLinked.retire, 'keep sole Google-linked shoot');

console.log('shootTitleMatch tests passed');
