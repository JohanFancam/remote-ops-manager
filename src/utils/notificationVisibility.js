const ANALYTICS_NOTIFICATION_TYPES = new Set([
  'calendar_request',
  'google_sync',
  'schedule_change',
  'cancelled',
  'postponed',
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

function normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Who can see a stored ShootNotification.
 * Admins see desk + role broadcasts. Remotes only see personal assign / approve /
 * cancel / postpone / time-change rows aimed at their email.
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
    if (targetEmail && targetEmail !== email) return false;
    return true;
  }

  if (isRemoteOperatorRole(user)) {
    if (!OPERATOR_PERSONAL_TYPES.has(type)) return false;
    return targetEmail === email;
  }

  if (user?.role === 'admin') {
    if (targetEmail && targetEmail === email) return true;
    if (notification.target_role === 'admin' || notification.target_role === 'admin_standby') return true;
    if (targetEmail && targetEmail !== email) return true;
    return true;
  }

  if (targetEmail && targetEmail === email) return true;
  if (notification.target_role && notification.target_role === user?.role) return true;
  return false;
}

export { ANALYTICS_NOTIFICATION_TYPES };
