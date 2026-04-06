/**
 * Formats a name with proper Title Case (each word capitalised).
 * Falls back to the full email address if no name is available.
 */
export function toTitleCase(str) {
  if (!str || !str.trim()) return '';
  return str
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Returns the best display name for a user given their User record and/or email.
 * Priority: full_name (Title Cased) → fallback to full email
 * @param {object|null} userRecord - User entity record (may be null)
 * @param {string} email - Email address as ultimate fallback
 * @param {string|null} storedName - Optional pre-stored name (e.g. admin_name on StandbyDay)
 */
export function getDisplayName(userRecord, email, storedName = null) {
  const fullName = userRecord?.full_name?.trim();
  if (fullName) return toTitleCase(fullName);
  if (storedName?.trim()) return toTitleCase(storedName.trim());
  return email || '';
}