import { parseSlackGamesList, flattenSlackMessage, looksLikeGamesList, captureRequirement } from './slackCalendar.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const generic = `Games for 24 September 2026
Lakers vs Jazz 7:00 PM ET / 02:00 SAST
Knicks vs Nets
19:30 local · 01:30 SA
Arsenal vs Liverpool 21:00 SAST
`;

const genericParsed = parseSlackGamesList(generic, { fallbackDate: '2026-09-23' });
assert(genericParsed.date === '2026-09-24', `generic date ${genericParsed.date}`);
assert(genericParsed.games.length === 3, `generic count ${genericParsed.games.length}`);
assert(genericParsed.games[0].title === 'Lakers vs Jazz', genericParsed.games[0].title);
assert(genericParsed.games[0].game_time === '02:00', genericParsed.games[0].game_time);
assert(genericParsed.games[1].title === 'Knicks vs Nets', genericParsed.games[1].title);
assert(genericParsed.games[1].game_time === '01:30', genericParsed.games[1].game_time);
assert(genericParsed.games[2].title === 'Arsenal vs Liverpool', genericParsed.games[2].title);
assert(genericParsed.games[2].game_time === '21:00', genericParsed.games[2].game_time);

const gameday = `GAMEDAY SCHEDULE 20260924
• Texas Rangers versus New York Mets
Game Status: Scheduled
Backbone Id: glif-rangers_1
Game PK: 401817067
Scheduled Start (SAST): 2026-09-24 20:35
Scheduled Start (Local): 2026-09-24 13:35
Capture Requirements: None (Event is not marked for capture)
• Boston Red Sox vs Cleveland Guardians
Game Status: Scheduled
Backbone Id: fp-redsox_1
Game PK: 401817061
Scheduled Start (SAST): 2026-09-25 00:45
Scheduled Start (Local): 2026-09-24 18:45
Capture Requirements: Data
`;

const parsed = parseSlackGamesList(gameday, { fallbackDate: '2026-09-20' });
assert(parsed.games.length === 2, `gameday count ${parsed.games.length}`);
assert(parsed.games[0].title === 'Texas Rangers vs New York Mets', parsed.games[0].title);
assert(parsed.games[0].date === '2026-09-24', `rangers date ${parsed.games[0].date}`);
assert(parsed.games[0].game_time === '20:35', parsed.games[0].game_time);
assert(parsed.games[0].local_time === '13:35', parsed.games[0].local_time);
assert(parsed.games[0].game_pk === '401817067', parsed.games[0].game_pk);
assert(parsed.games[0].backbone_id === 'glif-rangers_1', parsed.games[0].backbone_id);
assert(captureRequirement(parsed.games[0].capture).skipCreate === true, 'rangers should skip create');

assert(parsed.games[1].title === 'Boston Red Sox vs Cleveland Guardians', parsed.games[1].title);
assert(parsed.games[1].date === '2026-09-25', `red sox date ${parsed.games[1].date} must come from SAST, not header`);
assert(parsed.games[1].game_time === '00:45', parsed.games[1].game_time);
assert(parsed.games[1].local_time === '18:45', parsed.games[1].local_time);
assert(captureRequirement(parsed.games[1].capture).rig === 'Data', parsed.games[1].capture);

const splitFields = `GAMEDAY SCHEDULE 20260924
Texas Rangers vs New York Mets
Scheduled Start (SAST):
2026-09-24 20:35
Scheduled Start (Local):
2026-09-24 13:35
Capture Requirements:
None (Event is not marked for capture)
`;
const split = parseSlackGamesList(splitFields);
assert(split.games[0].game_time === '20:35', `split sast ${split.games[0].game_time}`);
assert(split.games[0].date === '2026-09-24', split.games[0].date);

const blocks = flattenSlackMessage({
  text: '',
  blocks: [
    { type: 'header', text: { type: 'plain_text', text: 'GAMEDAY SCHEDULE 20260924' } },
    { type: 'section', text: { type: 'mrkdwn', text: '*Texas Rangers vs New York Mets*' } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: '*Scheduled Start (SAST):*\n2026-09-24 20:35' },
        { type: 'mrkdwn', text: '*Scheduled Start (Local):*\n2026-09-24 13:35' },
        { type: 'mrkdwn', text: '*Game PK:*\n401817067' },
        { type: 'mrkdwn', text: '*Capture Requirements:*\nData' },
      ],
    },
  ],
});
assert(looksLikeGamesList(blocks), 'flattened blocks should look like a games list');
const fromBlocks = parseSlackGamesList(blocks);
assert(fromBlocks.games[0].title === 'Texas Rangers vs New York Mets', fromBlocks.games[0].title);
assert(fromBlocks.games[0].game_time === '20:35', fromBlocks.games[0].game_time);
assert(fromBlocks.games[0].game_pk === '401817067', fromBlocks.games[0].game_pk);

const singlePaste = `Boston Red Sox vs Cleveland Guardians
Scheduled Start (SAST): 2026-09-25 00:45
Capture Requirements: Data`;
const one = parseSlackGamesList(singlePaste);
assert(one.games.length === 1, `single paste ${one.games.length}`);
assert(one.games[0].date === '2026-09-25', one.games[0].date);
assert(one.games[0].game_time === '00:45', one.games[0].game_time);

console.log('slackCalendar parser ok');
