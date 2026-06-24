/**
 * Shared assignment approval logic for remote operator self-assignment.
 * All components must import from here — never hardcode limits elsewhere.
 *
 * LIMIT FIELD: pre_approved_operators (string[])
 * Only shoots where pre_approved_operators includes the user count toward the 6-limit.
 * assigned_operators must NOT be counted directly for the approval limit.
 */

export const AUTO_APPROVE_LIMIT = 6;

/** Normalize email for consistent comparison */
export const normalizeEmail = (email) =>
  typeof email === 'string' ? email.trim().toLowerCase() : '';

/** Check if an array includes an email (case-insensitive) */
export const hasEmail = (arr, email) => {
  const e = normalizeEmail(email);
  return (arr || []).some(x => normalizeEmail(x) === e);
};

/** Add email to array (normalized, deduped) */
export const addEmail = (arr, email) => {
  const e = normalizeEmail(email);
  const base = (arr || []).map(normalizeEmail);
  if (base.includes(e)) return arr || [];
  return [...(arr || []), e];
};

/** Remove email from array (case-insensitive) */
export const removeEmail = (arr, email) => {
  const e = normalizeEmail(email);
  return (arr || []).filter(x => normalizeEmail(x) !== e);
};

/**
 * Count upcoming pre-approved shoots for a user, excluding:
 *  - the current shoot being acted on
 *  - past shoots (before todayStr)
 *  - cancelled shoots
 *  - completed shoots
 *
 * Only counts shoots where pre_approved_operators includes the user.
 *
 * @param {Array}  shoots          - full shoot list
 * @param {string} email           - operator email
 * @param {string} currentShootId  - id of the shoot being acted on (excluded)
 * @param {string} todayStr        - today as 'yyyy-MM-dd'
 * @returns {number}
 */
export function getPreApprovedCount(shoots, email, currentShootId, todayStr) {
  if (!shoots || !email) return 0;
  const e = normalizeEmail(email);
  return shoots.filter(s =>
    s.id !== currentShootId &&
    s.date >= todayStr &&
    s.status !== 'cancelled' &&
    s.status !== 'completed' &&
    (s.pre_approved_operators || []).some(x => normalizeEmail(x) === e)
  ).length;
}

// Keep old export name as an alias so any un-migrated callers don't crash immediately.
export const getApprovedAssignmentCount = getPreApprovedCount;

/**
 * Find the paired shoot for auto-assign pairing logic.
 * Returns the closest unassigned/unpending paired shoot within the time window, or null.
 *
 * @param {Object} shoot               - the current shoot
 * @param {Array}  allShoots           - full shoot list
 * @param {Array}  autoAssignTeams     - configured team names e.g. ['Reds', 'Red Sox', 'Rangers']
 * @param {number} windowMinutes       - pairing window in minutes
 * @param {string} email               - operator email to check assignment against
 * @returns {Object|null}
 */
export function findPairedShoot(shoot, allShoots, autoAssignTeams, windowMinutes, email) {
  if (!shoot || !allShoots || autoAssignTeams.length === 0) return null;

  const isLinkedTeam = (s) => autoAssignTeams.some(t =>
    (s.client || s.title || '').toLowerCase().includes(t.toLowerCase())
  );

  const clickedIsLinked = isLinkedTeam(shoot);

  const shootMins = (() => {
    const t = shoot.game_time || '19:00';
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  })();

  const getGameMins = (s) => {
    const t = s.game_time || '19:00';
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const candidates = allShoots.filter(s =>
    s.id !== shoot.id &&
    s.date === shoot.date &&
    s.status !== 'cancelled' &&
    s.status !== 'completed' &&
    (clickedIsLinked || isLinkedTeam(s)) &&
    !hasEmail(s.assigned_operators, email) &&
    !hasEmail(s.pending_operators, email) &&
    Math.abs(getGameMins(s) - shootMins) <= windowMinutes
  );

  if (candidates.length === 0) return null;

  candidates.sort((a, b) =>
    Math.abs(getGameMins(a) - shootMins) - Math.abs(getGameMins(b) - shootMins)
  );

  return candidates[0];
}

/**
 * Find the shoot that was auto-paired to `email` alongside `shoot`.
 * Used for cascaded unassign.
 * @deprecated Use findPairedShootForUnassign for bidirectional unassign.
 */
export function findAutoAssignedPair(shoot, allShoots, windowMinutes, email) {
  return findPairedShootForUnassign(shoot, allShoots, [], windowMinutes, email);
}

/**
 * Find the paired shoot for bidirectional unassign.
 * Works whether the clicked shoot is the main shoot OR the auto-paired shoot.
 * Returns the other shoot that the operator is assigned/pending on, if it:
 *   - is on the same date
 *   - is a configured linked team
 *   - is within the time window
 *   - is not cancelled or completed
 *   - has the operator assigned or pending
 *
 * @param {Object} shoot            - the shoot being unassigned from
 * @param {Array}  allShoots        - full shoot list
 * @param {Array}  autoAssignTeams  - configured linked team names
 * @param {number} windowMinutes    - pairing window in minutes
 * @param {string} email            - operator email
 * @returns {Object|null}
 */
export function findPairedShootForUnassign(shoot, allShoots, autoAssignTeams, windowMinutes, email) {
  if (!shoot || !allShoots) return null;

  const getGameMins = (s) => {
    const t = s.game_time || '19:00';
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const shootMins = getGameMins(shoot);

  const isLinkedTeam = autoAssignTeams && autoAssignTeams.length > 0
    ? (s) => autoAssignTeams.some(t => (s.client || s.title || '').toLowerCase().includes(t.toLowerCase()))
    : () => true; // if no teams configured, fall back to any nearby shoot with auto_assigned_for

  // If teams are configured, both shoots must be linked teams
  const shootIsLinked = autoAssignTeams && autoAssignTeams.length > 0 ? isLinkedTeam(shoot) : true;

  const candidates = allShoots.filter(s =>
    s.id !== shoot.id &&
    s.date === shoot.date &&
    s.status !== 'cancelled' &&
    s.status !== 'completed' &&
    (hasEmail(s.assigned_operators, email) || hasEmail(s.pending_operators, email)) &&
    Math.abs(getGameMins(s) - shootMins) <= windowMinutes &&
    (
      // Either both are linked teams (standard pairing)
      (shootIsLinked && isLinkedTeam(s)) ||
      // Or fallback: find by auto_assigned_for marker on either shoot
      hasEmail(s.auto_assigned_for, email) ||
      hasEmail(shoot.auto_assigned_for, email)
    )
  );

  if (candidates.length === 0) return null;

  // Prefer the one with auto_assigned_for set (the secondary shoot), or closest by time
  candidates.sort((a, b) => {
    const aHasMarker = hasEmail(a.auto_assigned_for, email) ? 0 : 1;
    const bHasMarker = hasEmail(b.auto_assigned_for, email) ? 0 : 1;
    if (aHasMarker !== bHasMarker) return aHasMarker - bHasMarker;
    return Math.abs(getGameMins(a) - shootMins) - Math.abs(getGameMins(b) - shootMins);
  });

  return candidates[0];
}