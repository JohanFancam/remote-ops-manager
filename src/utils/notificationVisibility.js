const CALENDAR_UPDATE_TYPES = new Set([
  'schedule_change',
  'google_sync',
  'cancelled',
  'postponed',
]);

const ANALYTICS_NOTIFICATION_TYPES = new Set([
  ...CALENDAR_UPDATE_TYPES,
  'calendar_request',
]);

/** Remote Operator and Operator / Standby only see their own assignment and shoot-change alerts. */
export const OPERATOR_PERSONAL_TYPES = new Set([
  'assigned',
  'approved',
  'cancelled',
  'postponed',
  'schedule_change',
]);

export function isRemoteOperatorRole(user) {
  return user?.role === 'user' || user?.role === 'standby';
}

export function isCalendarWatchRole(user) {
  return user?.role === 'viewer' || user?.role === 'analytics';
}

function normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** Collapse per-operator copies of the same calendar update. */
export function notificationDedupeKey(notification) {
  const key = String(notification?.notification_key || notification?.id || '');
  return key.replace(/:[^:]+@[^:]+$/, '') || notification?.id;
}

/**
 * Who can see a stored ShootNotification.
 * Admins see every row. Remotes only see personal assign / approve /
 * cancel / postpone / time-change rows aimed at their email.
 * Viewers and Data Analytics see calendar updates (time/date changes and
 * Google sync), regardless of which operator the row was addressed to.
 */
export function userCanSeeNotification(notification, user, { ignoreDismissed = false } = {}) {
  const email = normEmail(user?.email);
  if (!email || !notification) return false;

  if (!ignoreDismissed) {
    const dismissedBy = notification.dismissed_by || [];
    if (dismissedBy.map((item) => normEmail(item)).includes(email)) return false;
  }

  const targetEmail = normEmail(notification.target_user_email);
  const type = notification.type;

  if (user?.role === 'analytics') {
    if (!ANALYTICS_NOTIFICATION_TYPES.has(type)) return false;
    if (type === 'calendar_request') return targetEmail === email;
    return CALENDAR_UPDATE_TYPES.has(type);
  }

  if (user?.role === 'viewer') {
    return CALENDAR_UPDATE_TYPES.has(type);
  }

  if (isRemoteOperatorRole(user)) {
    if (!OPERATOR_PERSONAL_TYPES.has(type)) return false;
    return targetEmail === email;
  }

  if (user?.role === 'admin') {
    return true;
  }

  if (targetEmail && targetEmail === email) return true;
  if (notification.target_role && notification.target_role === user?.role) return true;
  return false;
}

export { ANALYTICS_NOTIFICATION_TYPES, CALENDAR_UPDATE_TYPES };
