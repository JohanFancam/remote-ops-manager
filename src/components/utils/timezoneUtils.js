import { useSyncExternalStore } from 'react';

// All shoots store times in South African Standard Time (SAST = UTC+2, no DST).
export const SA_TZ = 'Africa/Johannesburg';
const SA_OFFSET_MIN = 120; // SAST is fixed UTC+2
const STORAGE_KEY = 'display_timezone';

// Curated list of common timezones for the manual selector.
export const COMMON_TIMEZONES = [
  { tz: 'Africa/Johannesburg', label: 'South Africa (SAST · UTC+2)' },
  { tz: 'America/New_York', label: 'New York (EST/EDT)' },
  { tz: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { tz: 'America/Denver', label: 'Denver (MST/MDT)' },
  { tz: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { tz: 'America/Toronto', label: 'Toronto (EST/EDT)' },
  { tz: 'Europe/London', label: 'London (GMT/BST)' },
  { tz: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { tz: 'Asia/Dubai', label: 'Dubai (GST)' },
  { tz: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { tz: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { tz: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { tz: 'UTC', label: 'UTC' },
];

export function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || SA_TZ;
  } catch {
    return SA_TZ;
  }
}

let listeners = new Set();
let cached = undefined;

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'auto';
  } catch {
    return 'auto';
  }
}

export function getManualTimezone() {
  return readStored();
}

// Returns the effective IANA timezone string actually used for display.
export function getDisplayTimezone() {
  const m = readStored();
  return m && m !== 'auto' ? m : detectTimezone();
}

export function setDisplayTimezone(tz) {
  try {
    localStorage.setItem(STORAGE_KEY, tz || 'auto');
  } catch {
    /* ignore */
  }
  cached = undefined;
  listeners.forEach((l) => l());
}

function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  if (cached === undefined) cached = getDisplayTimezone();
  return cached;
}

// React hook — re-renders when the timezone preference changes.
export function useDisplayTimezone() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// Convert a SAST wall-clock (date "YYYY-MM-DD" + time "HH:MM") into the true UTC instant.
export function saToUtc(saDate, saTime) {
  if (!saDate || !saTime) return null;
  const [y, m, d] = saDate.split('-').map(Number);
  const [h, mi] = saTime.split(':').map(Number);
  if ([y, m, d, h, mi].some((n) => Number.isNaN(n))) return null;
  return new Date(Date.UTC(y, m - 1, d, h, mi, 0, 0) - SA_OFFSET_MIN * 60000);
}

function partsInTz(utcInstant, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const map = {};
  fmt.formatToParts(utcInstant).forEach((pt) => {
    if (pt.type !== 'literal') map[pt.type] = pt.value;
  });
  let hour = map.hour;
  if (hour === '24') hour = '00';
  const dayNum = parseInt(map.day, 10);
  const weekdayShort = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(utcInstant);
  const monthShort = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short' }).format(utcInstant);
  const monthPadded = new Intl.DateTimeFormat('en-GB', { timeZone: tz, month: '2-digit' }).format(utcInstant);
  const dayPadded = String(dayNum).padStart(2, '0');
  return {
    weekdayLong: map.weekday,
    weekdayShort,
    monthLong: map.month,
    monthShort,
    monthPadded,
    dayNum,
    dayPadded,
    year: map.year,
    hour,
    minute: map.minute,
  };
}

// Format a Date (UTC instant) in the user's display timezone.
// Supports a small set of patterns used throughout the app.
export function formatInTz(utcInstant, pattern) {
  if (!utcInstant) return '';
  const tz = getDisplayTimezone();
  let p;
  try {
    p = partsInTz(utcInstant, tz);
  } catch {
    return '';
  }
  switch (pattern) {
    case 'HH:mm':
      return `${p.hour}:${p.minute}`;
    case 'EEE HH:mm':
      return `${p.weekdayShort} ${p.hour}:${p.minute}`;
    case 'EEE, MMM d':
      return `${p.weekdayShort}, ${p.monthShort} ${p.dayNum}`;
    case 'EEE, MMMM d':
      return `${p.weekdayShort}, ${p.monthLong} ${p.dayNum}`;
    case 'MMM d, yyyy':
      return `${p.monthShort} ${p.dayNum}, ${p.year}`;
    case 'MMMM d, yyyy':
      return `${p.monthLong} ${p.dayNum}, ${p.year}`;
    case 'EEEE':
      return p.weekdayLong;
    case 'd':
      return String(p.dayNum);
    case 'yyyy-MM-dd':
      return `${p.year}-${p.monthPadded}-${p.dayPadded}`;
    default:
      return `${p.hour}:${p.minute}`;
  }
}

// Display a shoot's game time in the user's display timezone ("HH:MM" or "").
export function displayShootTime(shoot) {
  const t = shoot?.game_time || shoot?.start_time;
  if (!t) return '';
  const inst = saToUtc(shoot?.date, t);
  if (!inst) return '';
  return formatInTz(inst, 'HH:mm');
}

// Returns the display-timezone date string ("YYYY-MM-DD") for a shoot's game time,
// accounting for timezone shifts (may differ from the stored SA date for late-night games).
export function displayShootDateStr(shoot) {
  const t = shoot?.game_time || shoot?.start_time;
  if (!shoot?.date) return '';
  const inst = t ? saToUtc(shoot.date, t) : null;
  if (!inst) return shoot.date;
  return formatInTz(inst, 'yyyy-MM-dd');
}

// True when the displayed date differs from the stored SA date (e.g. a late-night game
// that lands on the previous/next day in the user's timezone).
export function shootDateShifted(shoot) {
  const dd = displayShootDateStr(shoot);
  return !!dd && !!shoot?.date && dd !== shoot.date;
}

// Short timezone abbreviation for the current display tz (e.g. "EDT", "SAST").
export function tzAbbrev(tz) {
  const useTz = tz || getDisplayTimezone();
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: useTz, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((pt) => pt.type === 'timeZoneName')?.value || useTz;
  } catch {
    return useTz;
  }
}