/**
 * Google / Slack / app shoot title matching.
 * Kansas City Current, KC Current, and Current are the same team.
 * Charlotte FC and Charlotte are the same team.
 * Any shorter/longer spelling of the same side is treated as the same matchup.
 */

const TEAM_ALIASES = {
  'kansas city current': 'current',
  'kc current': 'current',
  'current': 'current',
  'charlotte fc': 'charlotte',
  'charlotte': 'charlotte',
};

const GENERIC_TOKENS = new Set([
  'fc', 'sc', 'cf', 'afc', 'cfc', 'united', 'city', 'club', 'the', 'de', 'la', 'el', 'of', 'and',
]);

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

function significantTokens(name) {
  return normTeam(name)
    .split(' ')
    .filter((token) => token && token.length > 1 && !GENERIC_TOKENS.has(token));
}

export function teamsMatch(a, b) {
  const left = canonicalTeamName(a);
  const right = canonicalTeamName(b);
  if (left && right && left === right) return true;
  const tokensA = significantTokens(a);
  const tokensB = significantTokens(b);
  if (!tokensA.length || !tokensB.length) return false;
  const lastA = tokensA[tokensA.length - 1];
  const lastB = tokensB[tokensB.length - 1];
  if (lastA.length >= 4 && lastA === lastB) return true;
  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const longer = tokensA.length <= tokensB.length ? tokensB : tokensA;
  const longerSet = new Set(longer);
  return shorter.every((token) => longerSet.has(token));
}

export function parseMatchupSides(title) {
  const cleaned = String(title || '').replace(/\s*\([^)]*\)\s*$/g, '').trim();
  const match = cleaned.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (!match) return cleaned ? [cleaned] : [];
  return [match[1].trim(), match[2].trim()];
}

export function matchupsEquivalent(a, b) {
  if (normalizeShootTitle(a) === normalizeShootTitle(b)) return true;
  const sidesA = parseMatchupSides(a);
  const sidesB = parseMatchupSides(b);
  if (sidesA.length === 2 && sidesB.length === 2) {
    return teamsMatch(sidesA[0], sidesB[0]) && teamsMatch(sidesA[1], sidesB[1]);
  }
  if (sidesA.length === 1 && sidesB.length === 1) return teamsMatch(sidesA[0], sidesB[0]);
  return matchupKey(a, 'd') === matchupKey(b, 'd');
}

/** Stable key for a matchup on a date, after team aliases. */
export function matchupKey(title, date = '') {
  const sides = parseMatchupSides(title).map(canonicalTeamName).filter(Boolean);
  const body = sides.length ? sides.join('|') : normalizeShootTitle(title);
  return `${date || ''}|${body}`;
}

export function titlesAreEquivalent(a, b) {
  return matchupsEquivalent(a, b);
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
 * Find the existing app shoot for an incoming calendar/Slack game.
 * Same team-name variant + same date updates a time change.
 * Same team-name variant + same game time is the same entry.
 * Already-linked Google rows are included so a new event id updates instead of duplicating.
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
    && matchupsEquivalent(shoot.title, title)
  ));
  if (!pool.length) return null;

  const sameDate = pool.filter((shoot) => shoot.date === date);
  if (sameDate.length === 1) return sameDate[0];
  if (sameDate.length > 1) {
    if (wantedTime) {
      const timed = sameDate.filter((shoot) => shootTime(shoot) === wantedTime);
      if (timed.length) return preferCandidate(timed);
    }
    const unlinked = sameDate.filter((shoot) => !shoot.google_event_id);
    if (unlinked.length === 1) return unlinked[0];
    return preferCandidate(sameDate);
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

/** @deprecated use findExistingShootMatch */
export function findAliasDateMatch(shoots, title, date, calendarId = '') {
  return findExistingShootMatch(shoots, { title, date, calendarId });
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
