/**
 * Google / Slack / app shoot title matching.
 * Kansas City Current, KC Current, and Current are the same team.
 * Charlotte FC and Charlotte are the same team.
 *
 * Same-game rows (including already-linked Google rows) are updated when
 * the time or date moves. Matching never retires or deletes a shoot.
 */

const TEAM_ALIASES = {
  'kansas city current': 'current',
  'kc current': 'current',
  'current': 'current',
  'charlotte fc': 'charlotte',
  'charlotte': 'charlotte',
};

export function normalizeShootTitle(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function normalizeGameTime(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
}

export function isManualShootTitle(title) {
  return /\bmanual\b/i.test(String(title || ''));
}

export function isAssignmentLocked(shoot) {
  if (!shoot) return false;
  if (shoot.assignment_locked === true) return true;
  return isManualShootTitle(shoot.title);
}

function normTeam(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[./']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalTeamName(name) {
  const key = normTeam(name);
  if (!key) return '';
  if (TEAM_ALIASES[key]) return TEAM_ALIASES[key];
  return key;
}

export function teamsMatch(a, b) {
  const left = canonicalTeamName(a);
  const right = canonicalTeamName(b);
  return Boolean(left && right && left === right);
}

export function parseMatchupSides(title) {
  const cleaned = String(title || '').replace(/\s*\([^)]*\)\s*$/g, '').trim();
  const match = cleaned.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (!match) return cleaned ? [cleaned] : [];
  return [match[1].trim(), match[2].trim()];
}

/** Stable key for a matchup on a date, after team aliases. */
export function matchupKey(title, date = '') {
  const sides = parseMatchupSides(title).map(canonicalTeamName).filter(Boolean);
  const body = sides.length ? sides.join('|') : normalizeShootTitle(title);
  return `${date || ''}|${body}`;
}

export function titlesAreEquivalent(a, b) {
  if (normalizeShootTitle(a) === normalizeShootTitle(b)) return true;
  const keyA = matchupKey(a, 'd');
  const keyB = matchupKey(b, 'd');
  return !!keyA && keyA === keyB;
}

export function matchupsEquivalent(a, b) {
  return titlesAreEquivalent(a, b);
}

function dateOffsetDays(from, to) {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity;
  return Math.round((b - a) / 86400000);
}

function sameCalendar(shoot, calendarId = '') {
  return !calendarId || !shoot.google_calendar_id || shoot.google_calendar_id === calendarId;
}

function shootTime(shoot) {
  return normalizeGameTime(shoot?.game_time || shoot?.start_time);
}

function preferCandidate(list = []) {
  if (!list.length) return null;
  return [...list].sort((a, b) => {
    const aLinked = a.google_event_id ? 1 : 0;
    const bLinked = b.google_event_id ? 1 : 0;
    if (aLinked !== bLinked) return aLinked - bLinked;
    return String(a.id || '').localeCompare(String(b.id || ''));
  })[0];
}

/**
 * Find the existing app shoot for an incoming calendar/Slack game so a
 * time or date change updates that row. Linked Google rows are included.
 * Never used to delete another shoot.
 */
export function findExistingShootMatch(shoots, {
  title,
  date,
  gameTime = '',
  calendarId = '',
} = {}) {
  if (!title || !date) return null;
  const wantedTime = normalizeGameTime(gameTime);
  const pool = (shoots || []).filter((shoot) => (
    shoot
    && sameCalendar(shoot, calendarId)
    && titlesAreEquivalent(shoot.title, title)
  ));
  if (!pool.length) return null;

  const sameDate = pool.filter((shoot) => shoot.date === date);
  if (sameDate.length === 1) return sameDate[0];
  if (sameDate.length > 1) {
    if (wantedTime) {
      const timed = sameDate.filter((shoot) => shootTime(shoot) === wantedTime);
      if (timed.length === 1) return timed[0];
      if (timed.length > 1) return preferCandidate(timed);
    }
    const unlinked = sameDate.filter((shoot) => !shoot.google_event_id);
    if (unlinked.length === 1) return unlinked[0];
    return null;
  }

  if (wantedTime) {
    const sameTimeNearby = pool.filter((shoot) => (
      shootTime(shoot) === wantedTime
      && Math.abs(dateOffsetDays(shoot.date, date)) <= 2
    ));
    if (sameTimeNearby.length === 1) return sameTimeNearby[0];
  }

  const nearby = pool.filter((shoot) => Math.abs(dateOffsetDays(shoot.date, date)) <= 2);
  return nearby.length === 1 ? nearby[0] : null;
}

/** Unlinked same-date / unique nearby alias. */
export function findAliasDateMatch(shoots, title, date, calendarId = '') {
  const wanted = matchupKey(title, date);
  if (!wanted || !date) return null;
  const list = (shoots || []).filter((shoot) => shoot && !shoot.google_event_id);
  return findExistingShootMatch(list, { title, date, calendarId });
}

/**
 * Keep the Google-linked row when the event id already matches.
 * Otherwise use the title/date/time match. Never retire another shoot.
 */
export function resolveExistingShoot(linked, aliasMatch) {
  return { keep: linked || aliasMatch || null, retire: null };
}
