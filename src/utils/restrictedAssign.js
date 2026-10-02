/** Games remotes cannot take. Admins and Operator / Standby still can. Manual stays locked for everyone. */

export const RESTRICTED_ASSIGN_TEAMS_KEY = 'restricted_assign_teams';

export function parseRestrictedAssignTeams(appSettings = []) {
  const raw = appSettings.find((item) => item.key === RESTRICTED_ASSIGN_TEAMS_KEY)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item || '').trim()).filter(Boolean);
  } catch {
    return String(raw)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

export function shootMatchesRestrictedAssign(shoot, teams = []) {
  if (!shoot || !teams.length) return false;
  const hay = `${shoot.title || ''} ${shoot.client || ''}`.toLowerCase();
  return teams.some((team) => {
    const needle = String(team || '').toLowerCase().trim();
    return !!needle && hay.includes(needle);
  });
}

export function isRemoteAssignRestricted(shoot, appSettings = []) {
  return shootMatchesRestrictedAssign(shoot, parseRestrictedAssignTeams(appSettings));
}

export function isRemoteOperatorRole(role) {
  return String(role || '') === 'user';
}

export function isRemoteAssignBlocked(shoot, user, appSettings = []) {
  return isRemoteOperatorRole(user?.role) && isRemoteAssignRestricted(shoot, appSettings);
}

export function canRoleTakeRestrictedShoot(role, shoot, appSettings = []) {
  if (!isRemoteAssignRestricted(shoot, appSettings)) return true;
  return role === 'admin' || role === 'standby';
}
