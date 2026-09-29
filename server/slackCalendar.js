/**
 * Fail-safe calendar sync from the Gameday Bot Slack channel.
 * Creates or updates shoots from parsed text. Never deletes.
 */
import { listEntities, createEntity, updateEntity } from './entities.js';
import { handleShootChange } from './notifications.js';
import { sastYmd } from './googleCalendar.js';
import { findExistingShootMatch, titlesAreEquivalent } from './shootTitleMatch.js';

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

function slackSyncEnabled() {
  const raw = settingValue('slack_sync_enabled').toLowerCase();
  return raw === 'true' || raw === '1';
}

export function getSlackGamesSettings() {
  const token = settingValue('slack_bot_token');
  const channelId = settingValue('slack_games_channel_id');
  return {
    enabled: slackSyncEnabled(),
    configured: Boolean(token && channelId),
    hasToken: Boolean(token),
    channelId,
    lastSyncAt: settingValue('slack_last_sync_at') || null,
    lastSyncStats: parseJson(settingValue('slack_last_sync_stats'), null),
  };
}

export function saveSlackGamesSettings({ botToken, channelId, enabled } = {}) {
  if (botToken === 'clear') {
    upsertSetting('slack_bot_token', '', 'Slack bot token for games-list sync');
  } else if (botToken) {
    upsertSetting('slack_bot_token', String(botToken).trim(), 'Slack bot token for games-list sync');
  }
  if (channelId !== undefined) {
    upsertSetting('slack_games_channel_id', String(channelId || '').trim(), 'Slack channel for the daily games list');
  }
  if (enabled !== undefined) {
    upsertSetting('slack_sync_enabled', enabled ? 'true' : 'false', 'Allow Slack Gameday sync on the calendar');
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
    .replace(/[*`~]+/g, '')
    .replace(/\r/g, '');
}

function collectBlockText(block, out) {
  if (!block || typeof block !== 'object') return;
  if (block.text?.text) out.push(String(block.text.text));
  if (typeof block.text === 'string') out.push(block.text);
  if (Array.isArray(block.fields)) {
    for (const field of block.fields) {
      if (field?.title || field?.value) {
        out.push(`${field.title || ''}: ${field.value || ''}`.trim());
      } else if (field?.text) {
        out.push(String(field.text));
      }
    }
  }
  if (Array.isArray(block.elements)) {
    for (const el of block.elements) collectBlockText(el, out);
  }
}

/** Flatten Slack Block Kit / attachments so Gameday Bot posts parse as text. */
export function flattenSlackMessage(msg) {
  if (!msg) return '';
  if (typeof msg === 'string') return stripSlackMarkup(msg);
  const parts = [];
  if (msg.text) parts.push(String(msg.text));
  for (const block of msg.blocks || []) collectBlockText(block, parts);
  for (const att of msg.attachments || []) {
    if (att.title) parts.push(String(att.title));
    if (att.pretext) parts.push(String(att.pretext));
    if (att.text) parts.push(String(att.text));
    if (att.fallback) parts.push(String(att.fallback));
    for (const block of att.blocks || []) collectBlockText(block, parts);
    for (const field of att.fields || []) {
      parts.push(`${field.title || ''}: ${field.value || ''}`.trim());
    }
  }
  return stripSlackMarkup(parts.filter(Boolean).join('\n'));
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toYmd(year, month, day) {
  if (!year || !month || !day) return '';
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseCompactYmd(value) {
  const m = String(value || '').match(/^(20\d{2})(\d{2})(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function parseDateTime(value) {
  const m = String(value || '').match(/(20\d{2})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  if (hour > 23 || minute > 59) return null;
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${pad2(hour)}:${pad2(minute)}` };
}

function detectDate(text, fallbackDate) {
  const schedule = String(text || '').match(/GAMEDAY\s*SCHEDULE\s*(\d{8})/i);
  if (schedule) return parseCompactYmd(schedule[1]);

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
  const cleaned = String(line || '')
    .replace(/^[\s•\-–—*●]+/, '')
    .replace(/\s+\d{1,2}[:.]\d{2}.*$/i, '')
    .replace(/\s+\((?:local|sast|sa|za|et|pt|ct).*?\)\s*$/i, '')
    .replace(/\s+[|–-]\s*$/, '')
    .trim();
  const vs = cleaned.match(/^(.{2,90}?)\s+(?:versus|vs\.?|v\.?)\s+(.{2,90})$/i);
  if (!vs) return '';
  const home = vs[1].replace(/\s+\([^)]*\)\s*$/, '').trim();
  const away = vs[2].replace(/\s+\([^)]*\)\s*$/, '').trim();
  if (!home || !away) return '';
  if (/^(game status|backbone|game pk|scheduled start|capture)/i.test(home)) return '';
  return `${home} vs ${away}`;
}

export function looksLikeGamesList(text) {
  const t = String(text || '');
  if (/GAMEDAY\s*SCHEDULE/i.test(t)) return true;
  if (/Scheduled\s*Start\s*\(\s*SAST\s*\)/i.test(t)) return true;
  const vsCount = (t.match(/\bvs\.?\b|\sversus\s|\sv\.?\s/gi) || []).length;
  return vsCount >= 2 || (vsCount >= 1 && /\b(sast|sa time|game pk|backbone)\b/i.test(t));
}

function emptyGame(title, raw) {
  return {
    title,
    date: '',
    game_time: '',
    local_time: '',
    game_pk: '',
    backbone_id: '',
    capture: '',
    status: '',
    raw: raw || title,
  };
}

function applyLabeledValue(game, label, value) {
  if (!game) return;
  const l = String(label || '').toLowerCase().replace(/[:\s]+$/g, '');
  const v = String(value || '').replace(/^[:\s]+/, '').trim();
  if (!v) return;

  if (/scheduled\s*start/.test(l) && /sast/.test(l)) {
    const dt = parseDateTime(v);
    if (dt) {
      game.date = dt.date;
      game.game_time = dt.time;
    }
    return;
  }
  if (/scheduled\s*start/.test(l) && /local/.test(l)) {
    const dt = parseDateTime(v);
    if (dt) game.local_time = dt.time;
    return;
  }
  if (/game\s*pk|gamepk/.test(l)) {
    game.game_pk = v.replace(/\s+/g, '');
    return;
  }
  if (/backbone/.test(l)) {
    game.backbone_id = v;
    return;
  }
  if (/capture/.test(l)) {
    game.capture = v;
    return;
  }
  if (/game\s*status|^status$/.test(l)) {
    game.status = v;
  }
}

function parseGamedaySchedule(text, fallbackDate) {
  const headerDate = detectDate(text, fallbackDate);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const games = [];
  let current = null;
  let pendingLabel = '';

  const flush = () => {
    if (!current?.title) {
      current = null;
      pendingLabel = '';
      return;
    }
    if (!current.date && headerDate) current.date = headerDate;
    games.push(current);
    current = null;
    pendingLabel = '';
  };

  for (const line of lines) {
    if (/^GAMEDAY\s*SCHEDULE/i.test(line) || /^[-—–]{3,}$/.test(line)) continue;

    const title = extractTitle(line);
    if (title) {
      flush();
      current = emptyGame(title, line);
      continue;
    }

    const labeled = line.match(/^(.{2,60}?)\s*:\s*(.*)$/);
    if (labeled && /game status|backbone|game pk|scheduled start|capture/i.test(labeled[1])) {
      if (!current) current = emptyGame('', line);
      if (labeled[2].trim()) {
        applyLabeledValue(current, labeled[1], labeled[2]);
        pendingLabel = '';
      } else {
        pendingLabel = labeled[1];
      }
      continue;
    }

    if (pendingLabel && current) {
      applyLabeledValue(current, pendingLabel, line);
      pendingLabel = '';
      continue;
    }

    const looseDt = parseDateTime(line);
    if (looseDt && current && !current.game_time) {
      current.date = looseDt.date;
      current.game_time = looseDt.time;
    }
  }
  flush();

  return {
    date: games.find((g) => g.date)?.date || headerDate,
    games: games.filter((g) => g.title),
  };
}

function parseGenericGamesList(text, fallbackDate) {
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
      game_pk: '',
      backbone_id: '',
      capture: '',
      status: '',
      raw: line,
    });
  }

  return { date, games };
}

export function parseSlackGamesList(rawText, { fallbackDate } = {}) {
  const text = stripSlackMarkup(typeof rawText === 'string' ? rawText : flattenSlackMessage(rawText));
  const gameday = parseGamedaySchedule(text, fallbackDate);
  const hasSastFields = gameday.games.some((game) => game.game_time && game.date);
  if (hasSastFields || /GAMEDAY\s*SCHEDULE|Scheduled\s*Start\s*\(\s*SAST\s*\)/i.test(text)) {
    return gameday;
  }
  return parseGenericGamesList(text, fallbackDate);
}

function findExistingShoot(shoots, game) {
  const list = shoots || [];
  if (game.game_pk) {
    const byPk = list.find((shoot) => String(shoot.game_pk || '') === String(game.game_pk));
    if (byPk) return byPk;
  }
  if (game.backbone_id) {
    const byBb = list.find((shoot) => String(shoot.backbone_id || '') === String(game.backbone_id));
    if (byBb) return byBb;
  }
  return findExistingShootMatch(list, {
    title: game.title,
    date: game.date,
    gameTime: game.game_time,
  });
}

export function captureRequirement(capture) {
  const c = String(capture || '').toLowerCase();
  if (!c) return { skipCreate: false, rig: '' };
  if (/(not marked|none)/.test(c) && !/(data|fancam)/.test(c)) {
    return { skipCreate: true, rig: '' };
  }
  if (/data\s*\/\s*fancam|data\s+and\s+fancam/.test(c)) return { skipCreate: false, rig: 'Data/Fancam' };
  if (/fancam/.test(c)) return { skipCreate: false, rig: 'Fancam' };
  if (/\bdata\b/.test(c)) return { skipCreate: false, rig: 'Data' };
  return { skipCreate: false, rig: '' };
}

export function applySlackGames({ text, fallbackDate, user, confirm = true } = {}) {
  const parsed = parseSlackGamesList(text, { fallbackDate });
  const existingShoots = listEntities('Shoot', '-date', 5000);
  const syncedAt = new Date().toISOString();
  const changes = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const game of parsed.games) {
    if (!game.title || !game.date) continue;
    const capture = captureRequirement(game.capture);
    const existing = findExistingShoot(existingShoots, game);
    if (!existing && capture.skipCreate) {
      skipped += 1;
      changes.push({
        action: confirm ? 'skipped' : 'would_skip',
        title: game.title,
        date: game.date,
        time: game.game_time,
        localTime: game.local_time,
        reason: 'not marked for capture',
      });
      continue;
    }

    if (existing) {
      const existingTime = existing.game_time || existing.start_time || '';
      const timeChanged = Boolean(game.game_time) && existingTime !== game.game_time;
      const titleChanged = existing.title !== game.title && !titlesAreEquivalent(existing.title, game.title);
      const dateChanged = Boolean(game.date) && existing.date !== game.date;
      const pkChanged = Boolean(game.game_pk) && existing.game_pk !== game.game_pk;
      const rigChanged = Boolean(capture.rig) && existing.rig_type_override !== capture.rig;
      const changed = timeChanged || titleChanged || dateChanged || pkChanged || rigChanged;
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
      if (dateChanged) patch.date = game.date;
      if (timeChanged) {
        patch.game_time = game.game_time;
        patch.start_time = game.game_time;
      }
      if (game.game_pk) patch.game_pk = game.game_pk;
      if (game.backbone_id) patch.backbone_id = game.backbone_id;
      if (capture.rig) patch.rig_type_override = capture.rig;
      if (game.local_time && !existing.description) {
        patch.description = `Local time ${game.local_time}`;
      }
      const next = updateEntity('Shoot', existing.id, patch);
      updated += 1;
      changes.push({
        action: 'updated',
        title: game.title,
        date: game.date,
        time: game.game_time,
        previousTime: existingTime,
        previousDate: dateChanged ? existing.date : undefined,
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
      const createdShoot = createEntity('Shoot', {
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
        game_pk: game.game_pk || '',
        backbone_id: game.backbone_id || '',
        ...(capture.rig ? { rig_type_override: capture.rig } : {}),
        ...DEFAULT_OFFSETS,
      }, user);
      if (createdShoot) existingShoots.push(createdShoot);
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
    skipped,
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
      text: flattenSlackMessage(msg),
      ts: msg.ts,
    }))
    .filter((msg) => looksLikeGamesList(msg.text));

  if (!messages.length) {
    const err = new Error('No Gameday schedule found in the recent Slack messages.');
    err.status = 404;
    throw err;
  }

  return messages[0].text;
}

export function todaySastYmd() {
  return sastYmd(new Date());
}

export { ZA_TZ };
