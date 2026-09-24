/**
 * Fail-safe calendar sync from the daily Slack games list.
 * Creates or updates shoots from parsed text. Never deletes.
 */
import { listEntities, createEntity, updateEntity } from './entities.js';
import { handleShootChange } from './notifications.js';
import { sastYmd } from './googleCalendar.js';

const ZA_TZ = 'Africa/Johannesburg';
const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const DEFAULT_OFFSETS = {
  setup_offset: -150,
  pre_shoot_offset: -120,
  attention_offset: -30,
  sound_offset: -30,
};

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

export function getSlackGamesSettings() {
  const token = settingValue('slack_bot_token');
  const channelId = settingValue('slack_games_channel_id');
  return {
    configured: Boolean(token && channelId),
    hasToken: Boolean(token),
    channelId,
    lastSyncAt: settingValue('slack_last_sync_at') || null,
    lastSyncStats: parseJson(settingValue('slack_last_sync_stats'), null),
  };
}

export function saveSlackGamesSettings({ botToken, channelId } = {}) {
  if (botToken === 'clear') {
    upsertSetting('slack_bot_token', '', 'Slack bot token for games-list sync');
  } else if (botToken) {
    upsertSetting('slack_bot_token', String(botToken).trim(), 'Slack bot token for games-list sync');
  }
  if (channelId !== undefined) {
    upsertSetting('slack_games_channel_id', String(channelId || '').trim(), 'Slack channel for the daily games list');
  }
  return getSlackGamesSettings();
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function stripSlackMarkup(text) {
  return String(text || '')
    .replace(/<https?:[^|>]+\|([^>]+)>/g, '$1')
    .replace(/<#[^|>]+\|([^>]+)>/g, '$1')
    .replace(/<@[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[*_`~]+/g, '')
    .replace(/\r/g, '');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toYmd(year, month, day) {
  if (!year || !month || !day) return '';
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function detectDate(text, fallbackDate) {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const named = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?,?\s+(20\d{2})\b/i);
  if (named) {
    return toYmd(Number(named[3]), MONTHS[named[2].toLowerCase()], Number(named[1]));
  }

  const namedFirst = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/i);
  if (namedFirst) {
    return toYmd(Number(namedFirst[3]), MONTHS[namedFirst[1].toLowerCase()], Number(namedFirst[2]));
  }

  const dmy = text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
  if (dmy) return toYmd(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));

  return fallbackDate || sastYmd(new Date());
}

function to24h(hour, minute, meridiem) {
  let h = Number(hour);
  const m = Number(minute);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  const mer = String(meridiem || '').toLowerCase();
  if (mer.startsWith('p') && h < 12) h += 12;
  if (mer.startsWith('a') && h === 12) h = 0;
  if (h > 23 || m > 59) return '';
  return `${pad2(h)}:${pad2(m)}`;
}

function extractTimes(line) {
  const sa = [];
  const other = [];
  const re = /(\d{1,2})[:.](\d{2})\s*(am|pm)?/ig;
  let match;
  while ((match = re.exec(line))) {
    const time = to24h(match[1], match[2], match[3]);
    if (!time) continue;
    const afterRaw = line.slice(match.index + match[0].length);
    const after = afterRaw.split(/\d{1,2}[:.]\d{2}/)[0].slice(0, 20);
    const before = line.slice(Math.max(0, match.index - 10), match.index);
    const around = `${before} ${after}`;
    if (/\b(sast|sa\s*time|za\s*time|johannesburg)\b/i.test(around) || /\bSA\b|\bZA\b/.test(around)) {
      sa.push(time);
    } else {
      other.push(time);
    }
  }
  return { sa, other };
}

function extractTitle(line) {
  const cleaned = line
    .replace(/^[\s•\-–—*]+/, '')
    .replace(/\s+\d{1,2}[:.]\d{2}.*$/i, '')
    .replace(/\s+\((?:local|sast|sa|za|et|pt|ct).*?\)\s*$/i, '')
    .replace(/\s+[|–-]\s*$/, '')
    .trim();
  const vs = cleaned.match(/^(.{2,80}?)\s+(?:vs\.?|v\.?|@)\s+(.{2,80})$/i);
  if (!vs) return '';
  const home = vs[1].replace(/\s+\([^)]*\)\s*$/, '').trim();
  const away = vs[2].replace(/\s+\([^)]*\)\s*$/, '').trim();
  if (!home || !away) return '';
  return `${home} vs ${away}`;
}

function looksLikeGamesList(text) {
  const vsCount = (String(text || '').match(/\bvs\.?\b|\sv\.?\s|@/gi) || []).length;
  return vsCount >= 2 || (vsCount >= 1 && /\b(sast|sa time|game)/i.test(text));
}

export function parseSlackGamesList(rawText, { fallbackDate } = {}) {
  const text = stripSlackMarkup(rawText);
  const date = detectDate(text, fallbackDate);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const games = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const title = extractTitle(line);
    if (!title) continue;
    let timeBlock = line;
    for (let look = 1; look <= 2; look += 1) {
      const next = lines[i + look];
      if (!next || extractTitle(next)) break;
      if (/\d{1,2}[:.]\d{2}/.test(next)) timeBlock += ` ${next}`;
    }
    const times = extractTimes(timeBlock);
    const gameTime = times.sa[0] || times.other[0] || '';
    games.push({
      title,
      date,
      game_time: gameTime,
      local_time: times.other[0] && times.other[0] !== gameTime ? times.other[0] : '',
      raw: line,
    });
  }

  return { date, games };
}

function normalizeTitle(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function findExistingShoot(shoots, title, date) {
  const wanted = normalizeTitle(title);
  return (shoots || []).find((shoot) => (
    shoot.date === date && normalizeTitle(shoot.title) === wanted
  )) || (shoots || []).find((shoot) => {
    if (shoot.date !== date) return false;
    const current = normalizeTitle(shoot.title);
    const [home, away] = wanted.split(' vs ');
    return home && away && current.includes(home) && current.includes(away);
  }) || null;
}

export function applySlackGames({ text, fallbackDate, user, confirm = true } = {}) {
  const parsed = parseSlackGamesList(text, { fallbackDate });
  const existingShoots = listEntities('Shoot', '-date', 5000);
  const syncedAt = new Date().toISOString();
  const changes = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const game of parsed.games) {
    if (!game.title || !game.date) continue;
    const existing = findExistingShoot(existingShoots, game.title, game.date);
    if (existing) {
      const existingTime = existing.game_time || existing.start_time || '';
      const timeChanged = Boolean(game.game_time) && existingTime !== game.game_time;
      const titleChanged = existing.title !== game.title;
      const changed = timeChanged || titleChanged;
      if (!confirm) {
        changes.push({
          action: changed ? 'would_update' : 'unchanged',
          title: game.title,
          date: game.date,
          time: game.game_time,
          localTime: game.local_time,
        });
        if (changed) updated += 1;
        else unchanged += 1;
        continue;
      }
      if (!changed) {
        unchanged += 1;
        continue;
      }
      const patch = {
        last_synced_at: syncedAt,
        source: existing.source || 'slack_games',
        slack_sync_flag: 'updated',
      };
      if (titleChanged) patch.title = game.title;
      if (timeChanged) {
        patch.game_time = game.game_time;
        patch.start_time = game.game_time;
      }
      const next = updateEntity('Shoot', existing.id, patch);
      updated += 1;
      changes.push({
        action: 'updated',
        title: game.title,
        date: game.date,
        time: game.game_time,
        previousTime: existingTime,
        localTime: game.local_time,
        calendar: 'Slack',
      });
      if (next) {
        handleShootChange(existing, next, user).catch((err) => {
          console.warn('Slack sync notification failed:', err.message);
        });
      }
    } else if (!confirm) {
      created += 1;
      changes.push({
        action: 'would_create',
        title: game.title,
        date: game.date,
        time: game.game_time,
        localTime: game.local_time,
      });
    } else {
      createEntity('Shoot', {
        title: game.title,
        client: '',
        location: '',
        date: game.date,
        game_time: game.game_time,
        start_time: game.game_time || '',
        status: 'upcoming',
        description: game.local_time ? `Local time ${game.local_time}` : '',
        assigned_operators: [],
        pending_operators: [],
        pre_approved_operators: [],
        auto_assigned_for: [],
        phase_status: {},
        last_synced_at: syncedAt,
        source: 'slack_games',
        slack_sync_flag: 'new',
        ...DEFAULT_OFFSETS,
      }, user);
      created += 1;
      changes.push({
        action: 'created',
        title: game.title,
        date: game.date,
        time: game.game_time,
        localTime: game.local_time,
        calendar: 'Slack',
      });
    }
  }

  const stats = {
    created,
    updated,
    unchanged,
    cancelled: 0,
    parsed: parsed.games.length,
    date: parsed.date,
  };
  if (confirm) {
    upsertSetting('slack_last_sync_at', syncedAt, 'Last Slack games-list sync');
    upsertSetting('slack_last_sync_stats', JSON.stringify(stats), 'Last Slack games-list sync stats');
  }
  return { ...stats, changes, preview: !confirm };
}

export async function fetchLatestSlackGamesMessage() {
  const token = settingValue('slack_bot_token');
  const channelId = settingValue('slack_games_channel_id');
  if (!token || !channelId) {
    const err = new Error('Slack channel is not connected. Add the bot token and channel in Settings.');
    err.status = 400;
    throw err;
  }

  const url = new URL('https://slack.com/api/conversations.history');
  url.searchParams.set('channel', channelId);
  url.searchParams.set('limit', '40');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.ok) {
    const err = new Error(data.error === 'not_in_channel'
      ? 'Invite the ROM bot into that Slack channel, then try again.'
      : data.error === 'channel_not_found'
        ? 'Slack channel not found. Check the channel ID.'
        : `Slack: ${data.error || 'could not read the channel'}`);
    err.status = 400;
    throw err;
  }

  const messages = (data.messages || [])
    .map((msg) => ({
      text: stripSlackMarkup(msg.text || ''),
      ts: msg.ts,
    }))
    .filter((msg) => looksLikeGamesList(msg.text));

  if (!messages.length) {
    const err = new Error('No games list found in the recent Slack messages.');
    err.status = 404;
    throw err;
  }

  return messages[0].text;
}

export function todaySastYmd() {
  return sastYmd(new Date());
}

export { looksLikeGamesList, ZA_TZ };
