import { groupShootsByDisplayDate, shootsForDisplayDate } from './calendarDayShoots.js';
import { SOURCE_TIMEZONE } from './timezone.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const shoots = [
  { id: 'b', date: '2026-10-04', game_time: '20:30', title: 'Late' },
  { id: 'a', date: '2026-10-04', game_time: '13:00', title: 'Early' },
  { id: 'c', date: '2026-10-05', game_time: '19:00', title: 'Next day' },
  { id: 'ny', date: '2026-10-06', game_time: '01:00', title: 'After midnight SAST' },
];

const sast = groupShootsByDisplayDate(shoots, SOURCE_TIMEZONE);
assert(shootsForDisplayDate(sast, '2026-10-04').map((s) => s.id).join(',') === 'a,b', 'sast day is sorted by time');
assert(shootsForDisplayDate(sast, '2026-10-05').length === 1, 'other sast day');
assert(shootsForDisplayDate(sast, '2026-10-06')[0].id === 'ny', 'late sast game stays on stored date');
assert(shootsForDisplayDate(sast, '2026-10-01').length === 0, 'empty day is empty');

const ny = groupShootsByDisplayDate(shoots, 'America/New_York');
assert(shootsForDisplayDate(ny, '2026-10-05')[0].id === 'ny', '01:00 SAST is previous evening in New York');

const many = Array.from({ length: 500 }, (_, i) => ({
  id: `s${i}`,
  date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
  game_time: '19:00',
}));
const started = Date.now();
const grouped = groupShootsByDisplayDate(many, SOURCE_TIMEZONE);
for (let day = 1; day <= 31; day += 1) {
  shootsForDisplayDate(grouped, `2026-10-${String(day).padStart(2, '0')}`);
}
const elapsed = Date.now() - started;
assert(elapsed < 50, `grouping 500 shoots should be cheap, took ${elapsed}ms`);

console.log('calendarDayShoots.test.js: ok');
