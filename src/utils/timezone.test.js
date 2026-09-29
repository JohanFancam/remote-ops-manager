import {
  DEFAULT_TIMEZONE,
  SOURCE_TIMEZONE,
  displayYmdForSource,
  formatHmInTz,
  formatYmdInTz,
  parseSourceDateTime,
  resolveTimezone,
  setDisplayTimeZone,
  zonedTimeToUtc,
} from './timezone.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(resolveTimezone('') === DEFAULT_TIMEZONE, 'empty defaults to SAST');
assert(resolveTimezone('Africa/Johannesburg') === SOURCE_TIMEZONE, 'sast stored');
assert(resolveTimezone('not-a-zone') === DEFAULT_TIMEZONE, 'invalid falls back');

const kickoff = parseSourceDateTime('2026-09-29', '20:00');
assert(kickoff instanceof Date, 'parses sast datetime');
assert(formatYmdInTz(kickoff, SOURCE_TIMEZONE) === '2026-09-29', 'sast date stays');
assert(formatHmInTz(kickoff, SOURCE_TIMEZONE) === '20:00', 'sast time stays');
assert(formatHmInTz(kickoff, 'America/New_York') === '14:00', 'converts to eastern');
assert(displayYmdForSource('2026-09-30', '01:00', 'America/New_York') === '2026-09-29', 'late sast game is previous evening in NY');

const london = zonedTimeToUtc('2026-06-15', '18:00', 'Europe/London');
assert(formatHmInTz(london, 'Europe/London') === '18:00', 'london wall clock');

setDisplayTimeZone('America/New_York');
assert(formatHmInTz(parseSourceDateTime('2026-09-29', '20:00'), 'America/New_York') === '14:00', 'display helper');
setDisplayTimeZone(DEFAULT_TIMEZONE);

console.log('timezone tests passed');
