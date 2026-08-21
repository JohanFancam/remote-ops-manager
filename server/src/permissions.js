/** Canonical roles. `operator` is the Remote User role. */
export const ROLES = Object.freeze({
  ADMIN: 'admin',
  OPERATOR: 'operator',
  ACCOUNTS: 'accounts',
  STANDBY: 'standby',
});

/** Display labels for UI. */
export const ROLE_LABELS = Object.freeze({
  admin: 'Admin',
  operator: 'Remote',
  accounts: 'Account',
  standby: 'Standby',
});

/** Normalize legacy / alias roles → canonical. */
export function normalizeRole(role) {
  if (role === 'user' || role === 'remote') return ROLES.OPERATOR;
  if (role === 'account') return ROLES.ACCOUNTS;
  return role;
}

export function roleLabel(role) {
  return ROLE_LABELS[normalizeRole(role)] || role;
}

export const PERMISSIONS = Object.freeze({
  // Shoots
  SHOOT_CREATE: 'shoot:create',
  SHOOT_EDIT: 'shoot:edit',
  SHOOT_CANCEL: 'shoot:cancel',
  SHOOT_VIEW_ALL: 'shoot:view_all',
  SHOOT_VIEW_OWN: 'shoot:view_own',
  SHOOT_IMPORT: 'shoot:import',
  SHOOT_PROGRESS_ANY: 'shoot:progress_any',
  SHOOT_PROGRESS_OWN: 'shoot:progress_own',

  // Assignments
  ASSIGN_MANUAL: 'assign:manual',
  ASSIGN_APPROVE: 'assign:approve',
  ASSIGN_SELF: 'assign:self',
  ASSIGN_OVERRIDE: 'assign:override',

  // Users
  USER_MANAGE: 'user:manage',
  SETTINGS_MANAGE: 'settings:manage',

  // Pay
  PAY_VIEW_OWN: 'pay:view_own',
  PAY_VIEW_ALL: 'pay:view_all',
  PAY_SETTLE: 'pay:settle',

  // Availability
  AVAIL_OWN: 'avail:own',
  AVAIL_VIEW_ALL: 'avail:view_all',

  // Ops surfaces
  DASHBOARD_OPS: 'dashboard:ops',
  DASHBOARD_ACCOUNTS: 'dashboard:accounts',
  CALENDAR_OPS: 'calendar:ops',
  RIG_MANAGE: 'rig:manage',
  RIG_VIEW: 'rig:view',
  STANDBY_MANAGE: 'standby:manage',
  STANDBY_VIEW: 'standby:view',
});

const ROLE_PERMS = {
  [ROLES.ADMIN]: new Set([
    PERMISSIONS.SHOOT_CREATE,
    PERMISSIONS.SHOOT_EDIT,
    PERMISSIONS.SHOOT_CANCEL,
    PERMISSIONS.SHOOT_VIEW_ALL,
    PERMISSIONS.SHOOT_IMPORT,
    PERMISSIONS.SHOOT_PROGRESS_ANY,
    PERMISSIONS.ASSIGN_MANUAL,
    PERMISSIONS.ASSIGN_APPROVE,
    PERMISSIONS.ASSIGN_OVERRIDE,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.PAY_VIEW_ALL,
    PERMISSIONS.AVAIL_VIEW_ALL,
    PERMISSIONS.DASHBOARD_OPS,
    PERMISSIONS.DASHBOARD_ACCOUNTS,
    PERMISSIONS.CALENDAR_OPS,
    PERMISSIONS.RIG_MANAGE,
    PERMISSIONS.RIG_VIEW,
    PERMISSIONS.STANDBY_MANAGE,
    PERMISSIONS.STANDBY_VIEW,
  ]),
  [ROLES.OPERATOR]: new Set([
    PERMISSIONS.SHOOT_VIEW_OWN,
    PERMISSIONS.SHOOT_PROGRESS_OWN,
    PERMISSIONS.ASSIGN_SELF,
    PERMISSIONS.PAY_VIEW_OWN,
    PERMISSIONS.AVAIL_OWN,
    PERMISSIONS.DASHBOARD_OPS,
    PERMISSIONS.CALENDAR_OPS,
    PERMISSIONS.RIG_VIEW,
    PERMISSIONS.STANDBY_VIEW,
  ]),
  [ROLES.ACCOUNTS]: new Set([
    PERMISSIONS.PAY_VIEW_ALL,
    PERMISSIONS.PAY_SETTLE,
    PERMISSIONS.DASHBOARD_ACCOUNTS,
  ]),
  [ROLES.STANDBY]: new Set([
    PERMISSIONS.SHOOT_VIEW_ALL,
    PERMISSIONS.ASSIGN_APPROVE,
    PERMISSIONS.DASHBOARD_OPS,
    PERMISSIONS.CALENDAR_OPS,
    PERMISSIONS.AVAIL_VIEW_ALL,
    PERMISSIONS.STANDBY_VIEW,
    PERMISSIONS.RIG_VIEW,
  ]),
};

export function roleHas(role, permission) {
  const r = normalizeRole(role);
  return ROLE_PERMS[r]?.has(permission) === true;
}

export function requirePermission(user, permission) {
  if (!user || !roleHas(user.role, permission)) {
    const err = new Error('Access denied');
    err.status = 403;
    err.code = 'ACCESS_DENIED';
    throw err;
  }
}

/** Post-login home route by role. */
export function homePathForRole(role) {
  const r = normalizeRole(role);
  if (r === ROLES.ACCOUNTS) return '/accounts';
  return '/dashboard';
}

/** Frontend route → required permission */
export const ROUTE_GUARDS = {
  '/dashboard': PERMISSIONS.DASHBOARD_OPS,
  '/calendar': PERMISSIONS.CALENDAR_OPS,
  '/users': PERMISSIONS.USER_MANAGE,
  '/settings': PERMISSIONS.SETTINGS_MANAGE,
  '/accounts': PERMISSIONS.DASHBOARD_ACCOUNTS,
  '/rigs': PERMISSIONS.RIG_VIEW,
};
