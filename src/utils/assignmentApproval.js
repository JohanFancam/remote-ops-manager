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
 * Check if a shoot is fully available (no assigned or pending operators from anyone).
 * Used as a safety gate before auto-pairing.
 */
export function isShootAvailableForAutoAssign(shoot) {
  if (!shoot) return false;
  return (
    (!shoot.assigned_operators || shoot.assigned_operators.length === 0) &&
    (!shoot.pending_operators || shoot.pending_operators.length === 0)
  );
}

/**
 * Find the paired shoot for auto-assign pairing logic.
 * Returns the closest fully-available paired shoot within the time window, or null.
 * A shoot is only returned if it has NO assigned and NO pending operators (by anyone).
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

  const getGameMins = (s) => {
    const t = s.game_time || '19:00';
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const shootMins = getGameMins(shoot);
  const clickedIsLinked = isLinkedTeam(shoot);

  // All nearby shoots on the same date within the time window that are fully available
  // (no assigned or pending operators from anyone — not just the current user)
  const nearby = allShoots.filter(s =>
    s.id !== shoot.id &&
    s.date === shoot.date &&
    s.status !== 'cancelled' &&
    s.status !== 'completed' &&
    isShootAvailableForAutoAssign(s) &&
    Math.abs(getGameMins(s) - shootMins) <= windowMinutes
  );

  // Count how many linked teams are in the nearby window (excluding the clicked shoot itself)
  const linkedNearby = nearby.filter(s => isLinkedTeam(s));
  const linkedNearbyCount = linkedNearby.length;

  if (!clickedIsLinked) {
    // Rule 3: clicked is NOT a linked team
    // - if 2+ linked teams in the window → block pairing entirely
    if (linkedNearbyCount >= 2) return null;
    // - if exactly 1 linked team → pair with it
    // - if 0 linked teams → no pairing (non-linked + non-linked not allowed)
    const linkedCandidate = linkedNearby[0];
    if (!linkedCandidate) return null;
    return linkedCandidate;
  }

  // Rule 4: clicked IS a linked team
  // First try to pair with another linked team
  if (linkedNearbyCount > 0) {
    linkedNearby.sort((a, b) =>
      Math.abs(getGameMins(a) - shootMins) - Math.abs(getGameMins(b) - shootMins)
    );
    return linkedNearby[0];
  }

  // No other linked team exists — pair with the closest non-linked shoot
  const nonLinkedNearby = nearby.filter(s => !isLinkedTeam(s));
  if (nonLinkedNearby.length === 0) return null;
  nonLinkedNearby.sort((a, b) =>
    Math.abs(getGameMins(a) - shootMins) - Math.abs(getGameMins(b) - shootMins)
  );
  return nonLinkedNearby[0];
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

/**
 * Build field updates to approve a pending operator onto a shoot.
 */
export function approvePendingFields(shoot, email) {
  return {
    assigned_operators: addEmail(shoot.assigned_operators, email),
    pending_operators: removeEmail(shoot.pending_operators, email),
  };
}

/**
 * Build field updates to decline/remove a pending operator.
 */
export function declinePendingFields(shoot, email) {
  return {
    pending_operators: removeEmail(shoot.pending_operators, email),
    auto_assigned_for: removeEmail(shoot.auto_assigned_for, email),
  };
}