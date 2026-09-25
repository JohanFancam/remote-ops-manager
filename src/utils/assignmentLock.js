/** Google events with "manual" in the name stay on the calendar but cannot be assigned. */

export function isManualShootTitle(title) {
  return /\bmanual\b/i.test(String(title || ''));
}

export function isAssignmentLocked(shoot) {
  if (!shoot) return false;
  if (shoot.assignment_locked === true) return true;
  return isManualShootTitle(shoot.title);
}
