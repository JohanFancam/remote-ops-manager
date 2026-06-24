/**
 * Shared assignment approval logic for remote operator self-assignment.
 * All components must import from here — never hardcode limits elsewhere.
 */

export const AUTO_APPROVE_LIMIT = 6;

/**
 * Count upcoming approved (assigned) shoots for a user, excluding:
 *  - the current shoot being clicked
 *  - past shoots (before todayStr)
 *  - cancelled shoots
 *  - completed shoots
 *  - shoots where the user is only in pending_operators
 *
 * @param {Array}  shoots        - full shoot list (from cache or prop)
 * @param {string} email         - operator email to count for
 * @param {string} currentShootId - id of the shoot currently being acted on (excluded from count)
 * @param {string} todayStr      - today's date as 'yyyy-MM-dd'
 * @returns {number}
 */
export function getApprovedAssignmentCount(shoots, email, currentShootId, todayStr) {
  if (!shoots || !email) return 0;
  return shoots.filter(s =>
    s.id !== currentShootId &&
    s.date >= todayStr &&
    s.status !== 'cancelled' &&
    s.status !== 'completed' &&
    (s.assigned_operators || []).includes(email)
  ).length;
}