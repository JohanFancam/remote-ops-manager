import { listEntities, createEntity, updateEntity } from './entities.js';
import { normalizeRigCheckDelivery, slackOpenHref } from './slackRigCheckUtils.js';

export { normalizeRigCheckDelivery, slackOpenHref };

function settingValue(key) {
  const settings = listEntities('AppSettings', null, 500);
  const row = settings.find((item) => item.key === key);
  return String(row?.value || '').trim();
}

function upsertSetting(key, value, description) {
  const settings = listEntities('AppSettings', null, 500);
  const existing = settings.find((item) => item.key === key);
  if (existing) return updateEntity('AppSettings', existing.id, { value });
  return createEntity('AppSettings', { key, value, description });
}

export function getRigCheckSlackSettings() {
  const token = settingValue('slack_bot_token');
  const channelId = settingValue('slack_rigcheck_channel_id');
  const teamId = settingValue('slack_rigcheck_team_id');
  const openUrl = settingValue('slack_rigcheck_open_url');
  const delivery = normalizeRigCheckDelivery(settingValue('slack_rigcheck_delivery'));
  return {
    delivery,
    channelId,
    teamId,
    openUrl,
    openHref: slackOpenHref({ openUrl, teamId, channelId }),
    hasToken: Boolean(token),
    canPost: Boolean(token && channelId),
  };
}

export function saveRigCheckSlackSettings({ channelId, teamId, openUrl, delivery } = {}) {
  if (channelId !== undefined) {
    upsertSetting('slack_rigcheck_channel_id', String(channelId || '').trim(), 'Slack channel for rig-check messages');
  }
  if (teamId !== undefined) {
    upsertSetting('slack_rigcheck_team_id', String(teamId || '').trim(), 'Slack workspace team ID for opening the rig-check channel');
  }
  if (openUrl !== undefined) {
    upsertSetting('slack_rigcheck_open_url', String(openUrl || '').trim(), 'Optional Slack deep link for the rig-check group');
  }
  if (delivery !== undefined) {
    upsertSetting('slack_rigcheck_delivery', normalizeRigCheckDelivery(delivery), 'How rig-check copy should reach Slack');
  }
  return getRigCheckSlackSettings();
}

export function parseRigCheckUserEmails() {
  const raw = settingValue('rig_check_users');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function canSendRigCheckMessage(user) {
  const role = String(user?.role || '');
  if (role === 'admin' || role === 'standby') return true;
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email) return false;
  return parseRigCheckUserEmails().includes(email);
}

export async function postSlackChatMessage({ text, channelId, token } = {}) {
  const bodyText = String(text || '').trim();
  const channel = String(channelId || '').trim();
  const botToken = String(token || '').trim();
  if (!bodyText) {
    const err = new Error('Message is empty');
    err.status = 400;
    throw err;
  }
  if (!botToken || !channel) {
    const err = new Error('Slack bot token and rig-check channel are not set');
    err.status = 400;
    throw err;
  }

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${botToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ channel, text: bodyText }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const err = new Error(data.error || 'Slack could not post that message');
    err.status = 400;
    throw err;
  }
  return data;
}

export async function postRigCheckToSlack(text) {
  const token = settingValue('slack_bot_token');
  const settings = getRigCheckSlackSettings();
  return postSlackChatMessage({
    text,
    channelId: settings.channelId,
    token,
  });
}
