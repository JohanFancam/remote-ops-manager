export const RIG_CHECK_ELIGIBLE_ROLES = ['admin', 'standby'];

export function isEligibleRigCheckRole(role) {
  return RIG_CHECK_ELIGIBLE_ROLES.includes(String(role || '').toLowerCase());
}

export function isActiveUser(user) {
  if (!user) return false;
  return !(user.inactive === true || user.inactive === 1 || user.inactive === '1' || user.inactive === 'true');
}

export function validateRigCheckAssignment({ shootId, assignee } = {}) {
  if (!String(shootId || '').trim()) {
    return 'Pick a shoot to assign rig testing';
  }
  if (!assignee || !isActiveUser(assignee)) {
    return 'Assignee not found';
  }
  if (!isEligibleRigCheckRole(assignee.role)) {
    return 'Rig tests can only be assigned to admins and operator/standby';
  }
  return null;
}

export function matchRigSetting(shoot, rigs = []) {
  if (!shoot) return null;
  const client = String(shoot.client || '').toLowerCase().trim();
  const title = String(shoot.title || '').toLowerCase().trim();
  const hay = `${client} ${title}`.replace(/\s+/g, ' ').trim();
  const vs = hay.match(/(.+?)\s+vs\.?\s+(.+)/);
  const home = String(vs?.[1] || client || '').trim();

  let best = null;
  let bestScore = 0;
  for (const rig of rigs || []) {
    const team = String(rig.team || '').toLowerCase().trim();
    if (!team) continue;
    const last = team.split(/\s+/).pop();
    let score = 0;
    if (team === client || team === title) score = 100;
    else if (hay.includes(team)) score = 80 + team.length;
    else if (last && last.length >= 4 && hay.includes(last)) score = 40 + last.length;
    else continue;
    if (home && (home.includes(team) || team.includes(home) || (last.length >= 4 && home.includes(last)))) {
      score += 15;
    }
    if (score > bestScore) {
      best = rig;
      bestScore = score;
    }
  }
  return best;
}

export function defaultCheckLabels(rig) {
  const raw = rig?.default_checks;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item || '').trim()).filter(Boolean);
}
