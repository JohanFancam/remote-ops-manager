import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs } from '../src/services/import.js';

describe('ICS parser', () => {
  it('parses folded VEVENT blocks', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260822T191000Z
DTEND:20260822T220000Z
SUMMARY:Reds @ Guardians
LOCATION:Progressive Field
DESCRIPTION:Away game\\, night
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    assert.equal(events.length, 1);
    assert.equal(events[0].title, 'Reds @ Guardians');
    assert.equal(events[0].date, '2026-08-22');
    assert.equal(events[0].gameTime, '19:10');
    assert.equal(events[0].venue, 'Progressive Field');
    assert.equal(events[0].teamName, 'Reds');
    assert.equal(events[0].opponent, 'Guardians');
  });
});
