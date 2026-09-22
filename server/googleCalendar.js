/**
 * Google Calendar sync → Remote Ops shoots.
 * Pulls title, date, and start time only; keeps app calendar UI format.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { listEntities, createEntity, updateEntity } from './entities.js';
import { handleShootChange, createNotifications } from './notifications.js';

const ZA_TZ = 'Africa/Johannesburg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const DEFAULT_OFFSETS = {
  setup_offset: -150,
  pre_shoot_offset: -120,
  attention_offset: -30,
  sound_offset: -30,
};

function tokenPath() {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'remote-ops.db');
  return path.join(path.dirname(dbPath), 'google-oauth.json');
}

function settingsPath() {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'remote-ops.db');
  return path.join(path.dirname(dbPath), 'google-calendar-settings.json');
}

function clientConfigPath() {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'remote-ops.db');
  return path.join(path.dirname(dbPath), 'google-oauth-client.json');
}

function readJson(file, fallback = null) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function getSavedOAuthClient() {
  return readJson(clientConfigPath(), {}) || {};
}

export function saveOAuthClient(patch = {}) {
  const prev = getSavedOAuthClient();
  const nextSecret = String(patch.clientSecret || '').trim();
  const next = {
    clientId: patch.clientId !== undefined ? String(patch.clientId || '').trim() : (prev.clientId || ''),
    clientSecret: nextSecret || prev.clientSecret || '',
    redirectUri: patch.redirectUri !== undefined ? String(patch.redirectUri || '').trim() : (prev.redirectUri || ''),
  };
  writeJson(clientConfigPath(), next);
  return next;
}

export function getGoogleConfig() {
  const saved = getSavedOAuthClient();
  const clientId = process.env.GOOGLE_CLIENT_ID || saved.clientId || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || saved.clientSecret || '';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
    || saved.redirectUri
    || `http://localhost:${process.env.PORT || 3001}/api/google/callback`;
  return { clientId, clientSecret, redirectUri, configured: !!(clientId && clientSecret) };
}

export function getGoogleSettings() {
  const saved = readJson(settingsPath(), {}) || {};
  const dataCalendarId = saved.dataCalendarId || saved.calendarId || '';
  const fancamCalendarId = saved.fancamCalendarId || '';
  return {
    calendarId: dataCalendarId || 'primary',
    dataCalendarId,
    fancamCalendarId,
    lastSyncAt: saved.lastSyncAt || null,
    lastSyncStats: saved.lastSyncStats || null,
    lastSyncChanges: saved.lastSyncChanges || [],
  };
}

export function getConfiguredCalendars() {
  const saved = readJson(settingsPath(), {}) || {};
  const settings = getGoogleSettings();
  const list = [];
  if (settings.dataCalendarId) {
    list.push({ id: settings.dataCalendarId, label: 'Data', rigType: 'Data' });
  }
  if (settings.fancamCalendarId && settings.fancamCalendarId !== settings.dataCalendarId) {
    list.push({ id: settings.fancamCalendarId, label: 'Fancam', rigType: 'Fancam' });
  } else if (settings.fancamCalendarId && settings.fancamCalendarId === settings.dataCalendarId) {
    list.push({ id: settings.fancamCalendarId, label: 'Data/Fancam', rigType: 'Data/Fancam' });
  }
  if (!list.length && saved.calendarId) {
    list.push({ id: saved.calendarId, label: 'Google', rigType: '' });
  }
  return list;
}

export function saveGoogleSettings(patch) {
  const next = { ...getGoogleSettings(), ...patch };
  writeJson(settingsPath(), next);
  return next;
}

export function getStoredTokens() {
  return readJson(tokenPath(), null);
}

export function saveTokens(tokens) {
  writeJson(tokenPath(), tokens);
}

export function clearTokens() {
  const file = tokenPath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function isGoogleConnected() {
  const tokens = getStoredTokens();
  return !!(tokens && (tokens.refresh_token || tokens.access_token));
}

function createOAuthClient() {
  const { clientId, clientSecret, redirectUri, configured } = getGoogleConfig();
  if (!configured) {
    const err = new Error('Google Calendar is not configured. Save the Client ID and Client Secret in Settings first.');
    err.status = 503;
    throw err;
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(state = '') {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: state || 'rom-google',
  });
}

export async function handleOAuthCallback(code) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  const existing = getStoredTokens() || {};
  saveTokens({
    ...existing,
    ...tokens,
    // Keep prior refresh_token if Google omits it on reconnect
    refresh_token: tokens.refresh_token || existing.refresh_token || null,
  });
  return getGoogleStatus();
}

export function getGoogleStatus() {
  const cfg = getGoogleConfig();
  const settings = getGoogleSettings();
  const calendars = getConfiguredCalendars();
  return {
    configured: cfg.configured,
    connected: isGoogleConnected(),
    calendarId: settings.dataCalendarId || settings.calendarId || 'primary',
    dataCalendarId: settings.dataCalendarId || '',
    fancamCalendarId: settings.fancamCalendarId || '',
    calendars,
    redirectUri: cfg.redirectUri,
    clientId: cfg.clientId || '',
    hasSecret: !!cfg.clientSecret,
    lastSyncAt: settings.lastSyncAt || null,
    lastSyncStats: settings.lastSyncStats || null,
    lastSyncChanges: settings.lastSyncChanges || [],
    writeToGoogle: false,
  };
}

async function getAuthedClient() {
  const tokens = getStoredTokens();
  if (!tokens) {
    const err = new Error('Google Calendar is not connected. Connect it in Settings first.');
    err.status = 400;
    throw err;
  }
  const client = createOAuthClient();
  client.setCredentials(tokens);
  client.on('tokens', (fresh) => {
    const merged = { ...getStoredTokens(), ...fresh };
    if (fresh.refresh_token) merged.refresh_token = fresh.refresh_token;
    saveTokens(merged);
  });
  return client;
}

function normalizeTitle(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function findTitleDateMatch(shoots, title, date) {
  const wanted = normalizeTitle(title);
  if (!wanted || !date) return null;
  return (shoots || []).find((shoot) => (
    !shoot.google_event_id
    && shoot.date === date
    && normalizeTitle(shoot.title) === wanted
  )) || null;
}

/** Convert Google event start → { date: yyyy-MM-dd, game_time: HH:mm|'' } in SAST. */
export function mapEventTimes(event) {
  const start = event.start || {};
  if (start.date && !start.dateTime) {
    return { date: start.date, game_time: '' };
  }
  if (start.dateTime) {
    const d = new Date(start.dateTime);
    if (Number.isNaN(d.getTime())) return null;
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: ZA_TZ }).format(d);
    const timeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: ZA_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    let hour = timeParts.find((p) => p.type === 'hour')?.value || '00';
    const minute = timeParts.find((p) => p.type === 'minute')?.value || '00';
    if (hour === '24') hour = '00';
    return { date, game_time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` };
  }
  return null;
}

async function listEventsForCalendar(calendar, calendarId, min, max) {
  const events = [];
  let pageToken;
  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin: min.toISOString(),
      timeMax: max.toISOString(),
      timeZone: ZA_TZ,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
      pageToken,
    });
    events.push(...(res.data.items || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return events;
}

/**
 * One-way Google → app sync. Never writes back to Google.
 * Syncs every configured calendar (Data and Fancam) in one pass so one
 * calendar cannot cancel the other's shoots.
 */
export async function syncGoogleCalendar({ user = null, timeMin = null, timeMax = null } = {}) {
  const auth = await getAuthedClient();
  const calendar = google.calendar({ version: 'v3', auth });
  const sources = getConfiguredCalendars();
  if (!sources.length) {
    const err = new Error('Choose the Data and Fancam calendars in Settings first.');
    err.status = 400;
    throw err;
  }

  const now = new Date();
  const min = timeMin || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const max = timeMax || new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  const fetched = [];
  for (const source of sources) {
    const items = await listEventsForCalendar(calendar, source.id, min, max);
    for (const event of items) {
      fetched.push({ event, source });
    }
  }

  const existingShoots = listEntities('Shoot', '-date', 5000);
  const byGoogleId = new Map(
    existingShoots
      .filter((s) => s.google_event_id)
      .map((s) => [s.google_event_id, s])
  );

  const seen = new Set();
  const changes = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  const syncedAt = new Date().toISOString();
  const syncedCalendarIds = new Set(sources.map((source) => source.id));

  for (const { event, source } of fetched) {
    if (!event.id || event.status === 'cancelled') continue;
    const times = mapEventTimes(event);
    if (!times?.date) {
      skipped += 1;
      continue;
    }

    const title = (event.summary || 'Untitled event').trim();
    seen.add(event.id);

    const existing = byGoogleId.get(event.id) || findTitleDateMatch(existingShoots, title, times.date);
    if (existing) {
      const existingTime = existing.game_time || existing.start_time || '';
      const restore = existing.status === 'cancelled' && existing.google_sync_cancelled;
      const timeChanged = existingTime !== times.game_time;
      const dateChanged = existing.date !== times.date;
      const titleChanged = existing.title !== title;
      const changed = titleChanged || dateChanged || timeChanged || restore || existing.google_event_id !== event.id;
      const patch = {
        google_event_id: event.id,
        google_calendar_id: source.id,
        google_calendar_label: source.label,
        last_synced_at: syncedAt,
        source: 'google_calendar',
        google_sync_flag: changed ? 'updated' : '',
      };
      if (source.rigType) patch.rig_type_override = source.rigType;
      if (titleChanged) patch.title = title;
      if (dateChanged) patch.date = times.date;
      if (timeChanged) {
        patch.game_time = times.game_time;
        patch.start_time = times.game_time || existing.start_time || '';
      }
      if (restore) {
        patch.status = 'upcoming';
        patch.google_sync_cancelled = false;
        patch.google_sync_flag = 'updated';
      }
      const next = updateEntity('Shoot', existing.id, patch);
      if (changed && next) {
        updated += 1;
        changes.push({
          action: restore ? 'restored' : 'updated',
          title,
          date: times.date,
          time: times.game_time,
          previousDate: existing.date,
          previousTime: existingTime,
          calendar: source.label,
        });
        handleShootChange(existing, next, user).catch((err) => {
          console.warn('Google sync notification failed:', err.message);
        });
      } else {
        unchanged += 1;
      }
    } else {
      createEntity('Shoot', {
        title,
        client: '',
        location: event.location || '',
        date: times.date,
        game_time: times.game_time,
        start_time: times.game_time || '',
        status: 'upcoming',
        description: '',
        assigned_operators: [],
        pending_operators: [],
        pre_approved_operators: [],
        auto_assigned_for: [],
        phase_status: {},
        rig_type_override: source.rigType || '',
        google_event_id: event.id,
        google_calendar_id: source.id,
        google_calendar_label: source.label,
        last_synced_at: syncedAt,
        source: 'google_calendar',
        google_sync_cancelled: false,
        google_sync_flag: 'new',
        ...DEFAULT_OFFSETS,
      }, user);
      created += 1;
      changes.push({
        action: 'created',
        title,
        date: times.date,
        time: times.game_time,
        calendar: source.label,
      });
    }
  }

  let cancelled = 0;
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
  for (const shoot of existingShoots) {
    if (!shoot.google_event_id) continue;
    if (seen.has(shoot.google_event_id)) continue;
    if ((shoot.date || '') < todayStr) continue;
    if (shoot.status === 'cancelled') continue;
    const shootCalendarId = shoot.google_calendar_id || '';
    if (shootCalendarId && !syncedCalendarIds.has(shootCalendarId)) continue;
    const next = updateEntity('Shoot', shoot.id, {
      status: 'cancelled',
      google_sync_cancelled: true,
      google_sync_flag: 'cancelled',
      last_synced_at: syncedAt,
    });
    cancelled += 1;
    changes.push({
      action: 'cancelled',
      title: shoot.title,
      date: shoot.date,
      time: shoot.game_time || shoot.start_time || '',
      calendar: shoot.google_calendar_label || '',
    });
    if (next) {
      handleShootChange(shoot, next, user).catch((err) => {
        console.warn('Google cancel notification failed:', err.message);
      });
    }
  }

  const stats = { created, updated, unchanged, cancelled, skipped };
  saveGoogleSettings({
    lastSyncAt: syncedAt,
    lastSyncStats: stats,
    lastSyncChanges: changes.slice(0, 80),
  });

  if (created || updated || cancelled) {
    const labels = sources.map((source) => source.label).join(' + ');
    const lines = [
      `${labels}: ${created} new, ${updated} updated, ${cancelled} cancelled.`,
      ...changes.slice(0, 8).map((item) => {
        if (item.action === 'updated' || item.action === 'restored') {
          return `${item.calendar}: ${item.title} — ${item.previousDate || ''} ${item.previousTime || ''} → ${item.date} ${item.time}`.trim();
        }
        return `${item.calendar}: ${item.action} ${item.title} (${item.date} ${item.time})`.trim();
      }),
    ];
    createNotifications({
      notificationKey: `google_sync:${syncedAt}`,
      type: 'google_sync',
      title: 'Google calendars synced',
      message: lines.join('\n'),
      targetEmails: [],
      targetRole: 'admin',
      createdByName: user?.full_name || user?.email || 'Google sync',
      url: '/Calendar',
    }).catch((err) => {
      console.warn('Google sync log notification failed:', err.message);
    });
  }

  return {
    ok: true,
    calendars: sources,
    created,
    updated,
    unchanged,
    cancelled,
    skipped,
    fetched: fetched.length,
    changes,
    syncedAt,
    timeZone: ZA_TZ,
    writeToGoogle: false,
  };
}

export async function listGoogleCalendars() {
  const auth = await getAuthedClient();
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.calendarList.list();
  return (res.data.items || []).map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: !!c.primary,
  }));
}
