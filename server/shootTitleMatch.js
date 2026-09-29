/**
 * Google / Slack / app shoot title matching.
 * Kansas City Current, KC Current, and Current are the same team.
 * Charlotte FC and Charlotte are the same team.
 *
 * Matching only considers unlinked app shoots. Already-linked Google rows
 * stay on their event id so a variant title cannot retire an assigned shoot.
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

/**
 * Find an existing app shoot for a Google event that is the same game
 * under a team-name variant. Prefers an unlinked shoot on the same date.
 */
export function findAliasDateMatch(shoots, title, date, calendarId = '') {
  const wanted = matchupKey(title, date);
  if (!wanted || !date) return null;
  const list = shoots || [];

  const sameCalendar = (shoot) => (
    !calendarId
    || !shoot.google_calendar_id
    || shoot.google_calendar_id === calendarId
  );

  const sameDate = list.filter((shoot) => (
    !shoot.google_event_id
    && shoot.date === date
    && sameCalendar(shoot)
    && matchupKey(shoot.title, shoot.date) === wanted
  ));
  if (sameDate.length) return sameDate[0];

  const nearbyTeams = list.filter((shoot) => {
    if (shoot.google_event_id) return false;
    if (!sameCalendar(shoot)) return false;
    if (Math.abs(dateOffsetDays(shoot.date, date)) > 2) return false;
    return matchupKey(shoot.title, 'x') === matchupKey(title, 'x');
  });
  return nearbyTeams.length === 1 ? nearbyTeams[0] : null;
}

/**
 * Same as findAliasDateMatch. Linked Google rows are never reused as a
 * variant match — that path deleted assigned shoots.
 */
export function findExistingShootMatch(shoots, {
  title,
  date,
  calendarId = '',
} = {}) {
  return findAliasDateMatch(shoots, title, date, calendarId);
}

/**
 * If Google already linked a recreation and the app still has the original
 * team-name variant, keep the app shoot (title + assignments) and retire
 * the Google-titled copy.
 */
export function resolveExistingShoot(linked, aliasMatch) {
  if (linked && aliasMatch && linked.id !== aliasMatch.id) {
    return { keep: aliasMatch, retire: linked };
  }
  return { keep: linked || aliasMatch || null, retire: null };
}
