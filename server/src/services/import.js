import { db, newId, nowIso } from '../db.js';

function findRigIdForTeam(teamName) {
  if (!teamName) return null;
  const row = db
    .prepare(
      `SELECT id FROM rigs WHERE active = 1 AND lower(team_name) = lower(?) LIMIT 1`
    )
    .get(teamName);
  return row?.id || null;
}

export function createShootFromImport(row, { createdBy, calendarSource }) {
  if (!row.title || !row.date) return null;
  const teamName = row.teamName || null;
  const rigId = row.rigId || findRigIdForTeam(teamName);
  const id = newId();
  db.prepare(
    `
    INSERT INTO shoots (
      id, title, team_name, opponent, date, setup_time, game_time, expected_end_time,
      venue, shoot_type, rig_id, status, notes, description, calendar_source,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    row.title,
    teamName,
    row.opponent || null,
    row.date,
    row.setupTime || null,
    row.gameTime || '19:00',
    row.expectedEndTime || null,
    row.venue || null,
    row.shootType || 'Data',
    rigId,
    row.notes || null,
    row.description || null,
    calendarSource || row.calendarSource || 'import',
    createdBy,
    nowIso(),
    nowIso()
  );
  return id;
}

export function importCsvRows(rows, { createdBy }) {
  let created = 0;
  const ids = [];
  for (const r of rows) {
    const id = createShootFromImport(r, { createdBy, calendarSource: 'csv' });
    if (id) {
      created += 1;
      ids.push(id);
    }
  }
  return { created, ids };
}

/** Minimal ICS VEVENT parser (supports multi-line folding). */
export function parseIcs(text) {
  const unfolded = String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '');
  const events = [];
  const blocks = unfolded.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    const get = (key) => {
      const re = new RegExp(`^${key}(?:;[^:\\n]*)?:(.*)$`, 'mi');
      const m = block.match(re);
      return m ? m[1].trim() : null;
    };
    const summary = get('SUMMARY');
    const dtStart = get('DTSTART');
    const dtEnd = get('DTEND');
    const location = get('LOCATION');
    const description = get('DESCRIPTION')?.replace(/\\n/g, '\n').replace(/\\,/g, ',');
    const parsed = parseIcsDate(dtStart);
    if (!summary || !parsed) continue;
    const endParsed = parseIcsDate(dtEnd);
    events.push({
      title: summary.replace(/\\,/g, ','),
      date: parsed.date,
      gameTime: parsed.time || '19:00',
      setupTime: null,
      expectedEndTime: endParsed?.time || null,
      venue: location?.replace(/\\,/g, ',') || null,
      description: description || null,
      teamName: guessTeam(summary),
      opponent: guessOpponent(summary),
    });
  }
  return events;
}

function parseIcsDate(value) {
  if (!value) return null;
  // All-day: 20260821
  if (/^\d{8}$/.test(value)) {
    return {
      date: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
      time: '19:00',
    };
  }
  // 20260821T190000Z or 20260821T190000
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!m) return null;
  return {
    date: `${m[1]}-${m[2]}-${m[3]}`,
    time: `${m[4]}:${m[5]}`,
  };
}

function guessTeam(summary) {
  const at = summary.match(/^(.+?)\s+@\s+/);
  if (at) return at[1].trim();
  const vs = summary.match(/^(.+?)\s+vs\.?\s+/i);
  if (vs) return vs[1].trim();
  return null;
}

function guessOpponent(summary) {
  const at = summary.match(/@\s+(.+)$/);
  if (at) return at[1].trim();
  const vs = summary.match(/vs\.?\s+(.+)$/i);
  if (vs) return vs[1].trim();
  return null;
}

export function importIcsText(text, { createdBy, calendarSource = 'ics' }) {
  const events = parseIcs(text);
  return importCsvRows(
    events.map((e) => ({ ...e, calendarSource })),
    { createdBy }
  );
}

/** Fetch a public Google Calendar ICS / webcal URL and import. */
export async function importFromUrl(url, { createdBy }) {
  let normalized = String(url || '').trim();
  if (normalized.startsWith('webcal://')) {
    normalized = `https://${normalized.slice('webcal://'.length)}`;
  }
  // Google Calendar public ICS pattern helpers
  if (/calendar\.google\.com\/calendar\/u\/\d+\/r/.test(normalized)) {
    throw Object.assign(new Error('Use the calendar ICS secret address (Settings → Integrate calendar → Secret address in iCal format)'), {
      status: 400,
    });
  }
  const res = await fetch(normalized, {
    headers: { Accept: 'text/calendar, text/plain, */*' },
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Failed to fetch calendar (${res.status})`), {
      status: 400,
    });
  }
  const text = await res.text();
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw Object.assign(new Error('URL did not return a valid ICS calendar'), {
      status: 400,
    });
  }
  return importIcsText(text, { createdBy, calendarSource: 'google' });
}
