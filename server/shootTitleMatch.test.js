import {
  canonicalTeamName,
  findExistingShootMatch,
  isManualShootTitle,
  isAssignmentLocked,
  matchupKey,
  matchupsEquivalent,
  normalizeGameTime,
  resolveExistingShoot,
  teamsMatch,
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

assert(teamsMatch('Kansas City Current', 'KC Current'), 'kc variants');
assert(teamsMatch('KC current', 'Kansas City Current'), 'kc reverse');
assert(teamsMatch('Away team', 'Away Team'), 'case variant');
assert(!teamsMatch('Current', 'Pride'), 'different teams');

assert(
  matchupKey('Kansas City Current vs Pride', '2026-09-12')
    === matchupKey('Current vs Pride', '2026-09-12'),
  'current vs pride key'
);
assert(
  matchupsEquivalent('Kansas City Current vs Away team', 'KC Current vs Away Team'),
  'full title variant'
);
assert(!matchupsEquivalent('Current vs Pride', 'Current vs Gotham'), 'different opponent');

assert(normalizeGameTime('19:00:00') === '19:00', 'normalize seconds');
assert(normalizeGameTime('9:30') === '09:30', 'normalize hour');

assert(titlesAreEquivalent('Kansas City Current vs Pride', 'Current vs Pride'), 'titles equivalent');

assert(isManualShootTitle('NWSL photo manual'), 'manual word');
assert(isManualShootTitle('Manual — Lady Gaga'), 'manual start');
assert(!isManualShootTitle('Current vs Pride'), 'not manual');
assert(isAssignmentLocked({ title: 'Concert Manual' }), 'locked by title');
assert(isAssignmentLocked({ title: 'Current vs Pride', assignment_locked: true }), 'locked by flag');
assert(!isAssignmentLocked({ title: 'Current vs Pride' }), 'not locked');

const existing = [
  { id: 'app-1', title: 'Current vs Pride', date: '2026-09-12', game_time: '19:00' },
  { id: 'app-2', title: 'Charlotte vs Union', date: '2026-09-20', google_calendar_id: 'data', game_time: '20:00' },
  { id: 'linked', title: 'Current vs Gotham', date: '2026-09-15', google_event_id: 'g1', game_time: '18:00' },
];

const currentHit = findExistingShootMatch(existing, {
  title: 'Kansas City Current vs Pride',
  date: '2026-09-12',
  gameTime: '19:00',
  calendarId: 'data',
});
assert(currentHit?.id === 'app-1', `current match ${currentHit?.id}`);

const variantTimeMatch = findExistingShootMatch(
  [{ id: 'kc', title: 'KC Current vs Away Team', date: '2026-10-04', game_time: '19:30' }],
  { title: 'Kansas City Current vs Away team', date: '2026-10-04', gameTime: '19:30' }
);
assert(variantTimeMatch?.id === 'kc', 'variant + matching time is the same entry');

const timeChange = findExistingShootMatch(
  [{ id: 'moved-time', title: 'KC Current vs Pride', date: '2026-09-12', game_time: '18:00', google_event_id: 'old' }],
  { title: 'Kansas City Current vs Pride', date: '2026-09-12', gameTime: '20:00', calendarId: 'data' }
);
assert(timeChange?.id === 'moved-time', 'same teams + same date updates a time change');

const charlotteHit = findExistingShootMatch(existing, {
  title: 'Charlotte FC vs Union',
  date: '2026-09-20',
  gameTime: '20:00',
  calendarId: 'data',
});
assert(charlotteHit?.id === 'app-2', `charlotte match ${charlotteHit?.id}`);

const linkedHit = findExistingShootMatch(existing, {
  title: 'Kansas City Current vs Gotham',
  date: '2026-09-15',
  gameTime: '18:30',
  calendarId: 'data',
});
assert(linkedHit?.id === 'linked', 'time-changed Google event updates the linked shoot');

const moved = findExistingShootMatch(
  [{ id: 'near', title: 'KC Current vs Pride', date: '2026-09-11', game_time: '19:00' }],
  { title: 'Kansas City Current vs Pride', date: '2026-09-12', gameTime: '19:00', calendarId: 'data' }
);
assert(moved?.id === 'near', 'unique nearby alias with the same time updates date');

const doubleHeader = findExistingShootMatch(
  [
    { id: 'early', title: 'Current vs Pride', date: '2026-09-12', game_time: '15:00' },
    { id: 'late', title: 'Current vs Pride', date: '2026-09-12', game_time: '20:00' },
  ],
  { title: 'KC Current vs Pride', date: '2026-09-12', gameTime: '20:00' }
);
assert(doubleHeader?.id === 'late', 'same-day doubleheader matches by game time');

const resolved = resolveExistingShoot(
  { id: 'g-dup', title: 'Kansas City Current vs Pride', google_event_id: 'evt-1' },
  { id: 'app-1', title: 'Current vs Pride' }
);
assert(resolved.keep?.id === 'app-1', 'prefer app shoot over Google recreation');
assert(resolved.retire?.id === 'g-dup', 'retire Google-titled duplicate');

const onlyLinked = resolveExistingShoot({ id: 'g1', google_event_id: 'e' }, null);
assert(onlyLinked.keep?.id === 'g1' && !onlyLinked.retire, 'keep sole Google-linked shoot');

console.log('shootTitleMatch tests passed');
