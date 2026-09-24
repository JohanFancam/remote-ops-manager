import { parseSlackGamesList } from './slackCalendar.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const sample = `Games for 24 September 2026
Lakers vs Jazz 7:00 PM ET / 02:00 SAST
Knicks vs Nets
19:30 local · 01:30 SA
Arsenal vs Liverpool 21:00 SAST
`;

const parsed = parseSlackGamesList(sample, { fallbackDate: '2026-09-23' });
assert(parsed.date === '2026-09-24', `date ${parsed.date}`);
assert(parsed.games.length === 3, `count ${parsed.games.length}`);
assert(parsed.games[0].title === 'Lakers vs Jazz', parsed.games[0].title);
assert(parsed.games[0].game_time === '02:00', parsed.games[0].game_time);
assert(parsed.games[1].title === 'Knicks vs Nets', parsed.games[1].title);
assert(parsed.games[1].game_time === '01:30', parsed.games[1].game_time);
assert(parsed.games[2].title === 'Arsenal vs Liverpool', parsed.games[2].title);
assert(parsed.games[2].game_time === '21:00', parsed.games[2].game_time);
console.log('slackCalendar parser ok');
