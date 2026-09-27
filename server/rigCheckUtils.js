export function matchRigSetting(shoot, rigs = []) {
  if (!shoot) return null;
  const client = String(shoot.client || '').toLowerCase().trim();
  const title = String(shoot.title || '').toLowerCase().trim();
  return (rigs || []).find((r) => {
    const team = String(r.team || '').toLowerCase().trim();
    if (!team) return false;
    return (
      team === client || team === title
      || (client && client.includes(team))
      || (title && title.includes(team))
      || (client && team.includes(client))
      || (title && team.includes(title))
    );
  }) || null;
}

export function defaultCheckLabels(rig) {
  const raw = rig?.default_checks;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item || '').trim()).filter(Boolean);
}
