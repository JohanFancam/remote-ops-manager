const DELIVERY_MODES = ['copy_open', 'post', 'both'];

export function normalizeRigCheckDelivery(value) {
  const mode = String(value || '').trim().toLowerCase();
  return DELIVERY_MODES.includes(mode) ? mode : 'copy_open';
}

export function slackOpenHref({ openUrl, teamId, channelId } = {}) {
  const custom = String(openUrl || '').trim();
  if (custom) return custom;
  const team = String(teamId || '').trim();
  const channel = String(channelId || '').trim();
  if (team && channel) return `slack://channel?team=${encodeURIComponent(team)}&id=${encodeURIComponent(channel)}`;
  if (channel) return `https://slack.com/app_redirect?channel=${encodeURIComponent(channel)}`;
  return 'slack://open';
}
