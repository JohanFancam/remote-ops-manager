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