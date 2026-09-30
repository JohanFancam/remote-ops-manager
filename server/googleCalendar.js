/**
 * Google Calendar sync → Remote Ops shoots.
 * Pulls title, date, and start time only; keeps app calendar UI format.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { listEntities, createEntity, updateEntity, deleteEntity } from './entities.js';
import { handleShootChange, createNotifications } from './notifications.js';
import { archiveDeletedShoot, shootHasPeople } from './shootArchive.js';
import {
  findExistingShootMatch,
  isManualShootTitle,
  matchupKey,
  normalizeGameTime,
  titlesAreEquivalent,
} from './shootTitleMatch.js';

const ZA_TZ = 'Africa/Johannesburg';
export const AUTO_SYNC_HOURS = [6, 13, 20];

export function sastYmd(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZA_TZ }).format(date);
}

function addCalendarDays(ymd, days) {
  const [year, month, day] = String(ymd || '').split('-').map(Number);
  if (!year || !month || !day) return ymd;
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

let scheduledSyncInFlight = false;

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
    lastRestoreAt: saved.lastRestoreAt || null,
    lastRestoreStats: saved.lastRestoreStats || null,
    lastAutoSyncSlot: saved.lastAutoSyncSlot || null,
    autoSyncHours: AUTO_SYNC_HOURS,
    autoSyncTimeZone: ZA_TZ,
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
    lastRestoreAt: settings.lastRestoreAt || null,
    lastRestoreStats: settings.lastRestoreStats || null,
    lastAutoSyncSlot: settings.lastAutoSyncSlot || null,
    autoSyncHours: AUTO_SYNC_HOURS,
    autoSyncTimeZone: ZA_TZ,
    writeToGoogle: false,
  };
}

function sastDateHour(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  };
}

export function currentAutoSyncSlot(now = new Date()) {
  const { date, hour } = sastDateHour(now);
  const dueHour = [...AUTO_SYNC_HOURS].reverse().find((h) => hour >= h);
  if (dueHour === undefined) return null;
  return `${date}-${String(dueHour).padStart(2, '0')}`;
}

/**
 * Pull Data + Fancam three times a day (06:00, 13:00, 20:00 SAST).
 * If the process was down during a slot, the next minute after it comes
 * back will catch up once for that slot.
 */
export async function maybeRunScheduledGoogleSync() {
  if (scheduledSyncInFlight) return null;
  if (!isGoogleConnected()) return null;
  if (!getConfiguredCalendars().length) return null;
  const slot = currentAutoSyncSlot();
  if (!slot) return null;
  if (getGoogleSettings().lastAutoSyncSlot === slot) return null;

  scheduledSyncInFlight = true;
  try {
    const result = await syncGoogleCalendar({ user: null });
    saveGoogleSettings({ lastAutoSyncSlot: slot });
    console.log(
      `Scheduled Google sync ${slot}: ${result.created} new, ${result.updated} updated, ${result.cancelled} cancelled`
    );
    return result;
  } finally {
    scheduledSyncInFlight = false;
  }
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

function findTitleDateMatch(shoots, title, date, calendarId = '', gameTime = '') {
  return findExistingShootMatch(shoots, { title, date, gameTime, calendarId });
}

function assignmentSnapshot(shoot) {
  return {
    shootId: shoot?.id || '',
    assigned_operators: [...(shoot?.assigned_operators || [])],
    pending_operators: [...(shoot?.pending_operators || [])],
  };
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
  const todayYmd = sastYmd(now);
  const windowStartYmd = timeMin ? sastYmd(new Date(timeMin)) : addCalendarDays(todayYmd, -30);
  const windowEndYmd = timeMax ? sastYmd(new Date(timeMax)) : addCalendarDays(todayYmd, 180);
  // Fetch a padded SAST-day window so games on the first/last day are not
  // missing from Google's list and then treated as deleted.
  const min = new Date(`${addCalendarDays(windowStartYmd, -2)}T00:00:00+02:00`);
  const max = new Date(`${addCalendarDays(windowEndYmd, 2)}T23:59:59.999+02:00`);

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
  let cancelled = 0;
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

    const linked = byGoogleId.get(event.id) || null;
    const aliasMatch = findTitleDateMatch(
      existingShoots.filter((shoot) => !linked || shoot.id !== linked.id),
      title,
      times.date,
      source.id,
      times.game_time
    );
    const existing = linked || aliasMatch || null;
    const assignmentLocked = isManualShootTitle(title) || isManualShootTitle(existing?.title);
    if (existing) {
      const previousEventId = existing.google_event_id;
      existing.google_event_id = event.id;
      byGoogleId.set(event.id, existing);
      const existingTime = existing.game_time || existing.start_time || '';
      const restore = existing.status === 'cancelled' && existing.google_sync_cancelled;
      const timeChanged = normalizeGameTime(existingTime) !== normalizeGameTime(times.game_time);
      const dateChanged = existing.date !== times.date;
      const keepAppTitle = titlesAreEquivalent(existing.title, title);
      const titleChanged = !keepAppTitle && existing.title !== title;
      const lockChanged = !!existing.assignment_locked !== assignmentLocked;
      const linkedNow = previousEventId !== event.id;
      const changed = titleChanged || dateChanged || timeChanged || restore || linkedNow || lockChanged;
      const patch = {
        google_event_id: event.id,
        google_calendar_id: source.id,
        google_calendar_label: source.label,
        last_synced_at: syncedAt,
        source: 'google_calendar',
        google_sync_flag: changed ? 'updated' : '',
        assignment_locked: assignmentLocked,
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
      const idx = existingShoots.findIndex((shoot) => shoot.id === existing.id);
      if (idx >= 0) existingShoots[idx] = next || { ...existing, ...patch };
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
      const createdShoot = createEntity('Shoot', {
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
        assignment_locked: isManualShootTitle(title),
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
      existingShoots.push(createdShoot);
      byGoogleId.set(event.id, createdShoot);
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

  const windowStart = windowStartYmd;
  const windowEnd = windowEndYmd;
  const claimedEventIds = new Set();
  const claimedCalKeys = new Set();
  const latestShoots = listEntities('Shoot', '-date', 5000);

  const removeShoot = (shoot, action = 'deleted') => {
    archiveDeletedShoot(shoot, action);
    const snapshot = assignmentSnapshot(shoot);
    if (shootHasPeople(shoot)) {
      updateEntity('Shoot', shoot.id, {
        status: 'cancelled',
        google_sync_cancelled: true,
        google_sync_flag: 'cancelled',
      });
      cancelled += 1;
      changes.push({
        action: 'cancelled',
        title: shoot.title,
        date: shoot.date,
        time: shoot.game_time || shoot.start_time || '',
        calendar: shoot.google_calendar_label || '',
        ...snapshot,
      });
      return;
    }
    deleteEntity('Shoot', shoot.id);
    cancelled += 1;
    changes.push({
      action,
      title: shoot.title,
      date: shoot.date,
      time: shoot.game_time || shoot.start_time || '',
      calendar: shoot.google_calendar_label || '',
      ...snapshot,
    });
    createNotifications({
      notificationKey: `google_sync_delete:${shoot.id}:${syncedAt}`,
      type: 'google_sync',
      title: 'Shoot removed from calendar',
      message: `${shoot.google_calendar_label || 'Google'}: ${shoot.title} is no longer on Google and was removed from the app.`,
      shoot,
      targetEmails: [],
      targetRole: 'admin',
      createdByName: user?.full_name || user?.email || 'Google sync',
      url: '/Calendar',
      extras: snapshot,
    }).catch((err) => {
      console.warn('Google delete notification failed:', err.message);
    });
  };

  for (const shoot of latestShoots) {
    const eventId = shoot.google_event_id;
    const inWindow = (shoot.date || '') >= windowStart && (shoot.date || '') <= windowEnd;
    const shootCalendarId = shoot.google_calendar_id || '';
    const fromSyncedCalendar = !shootCalendarId || syncedCalendarIds.has(shootCalendarId);
    const isPast = (shoot.date || '') < todayYmd;
    if (eventId && fromSyncedCalendar && inWindow && !isPast && !seen.has(eventId)) {
      removeShoot(shoot, 'deleted');
      continue;
    }
    if (eventId && seen.has(eventId)) {
      if (claimedEventIds.has(eventId)) {
        removeShoot(shoot, 'duplicate');
        continue;
      }
      claimedEventIds.add(eventId);
      if (shootCalendarId && shoot.date) {
        claimedCalKeys.add(`${shootCalendarId}|${matchupKey(shoot.title, shoot.date)}`);
      }
    }
  }

  for (const shoot of listEntities('Shoot', '-date', 5000)) {
    const eventId = shoot.google_event_id;
    if (eventId && seen.has(eventId)) continue;
    const shootCalendarId = shoot.google_calendar_id || '';
    const calKey = shootCalendarId && shoot.date
      ? `${shootCalendarId}|${matchupKey(shoot.title, shoot.date)}`
      : '';
    if (calKey && claimedCalKeys.has(calKey) && !shootHasPeople(shoot) && shoot.google_sync_flag !== 'restored') {
      removeShoot(shoot, 'duplicate');
    }
  }

  const stats = { created, updated, unchanged, cancelled, skipped, deleted: cancelled };
  saveGoogleSettings({
    lastSyncAt: syncedAt,
    lastSyncStats: stats,
    lastSyncChanges: changes.slice(0, 80),
  });

  if (created || updated || cancelled) {
    const labels = sources.map((source) => source.label).join(' + ');
    const lines = [
      `${labels}: ${created} new, ${updated} updated, ${cancelled} removed.`,
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
