import { listEntities } from './entities.js';
import { findUserByEmail } from './auth.js';

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

export function loadRestrictedAssignTeams() {
  return parseRestrictedAssignTeams(listEntities('AppSettings'));
}

export function isRemoteOperatorEmail(email) {
  const user = findUserByEmail(String(email || '').trim().toLowerCase());
  return user?.role === 'user';
}

export function restrictedRemoteAssignError(shoot, emails = []) {
  const teams = loadRestrictedAssignTeams();
  if (!shootMatchesRestrictedAssign(shoot, teams)) return null;
  const remotes = (emails || []).filter((email) => isRemoteOperatorEmail(email));
  if (!remotes.length) return null;
  return 'Remote operators cannot be assigned to this game.';
}
