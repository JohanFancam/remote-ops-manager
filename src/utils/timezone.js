/** Stored shoot / standby times are South African Time. Display follows the signed-in user. */
export const SOURCE_TIMEZONE = 'Africa/Johannesburg';
export const DEFAULT_TIMEZONE = 'Africa/Johannesburg';
export const DEVICE_TIMEZONE = 'device';

export const TIMEZONE_OPTIONS = [
  { value: DEFAULT_TIMEZONE, label: 'South African Time (default)' },
  { value: DEVICE_TIMEZONE, label: 'Use my device time zone' },
  { value: 'Europe/London', label: 'United Kingdom (London)' },
  { value: 'Europe/Dublin', label: 'Ireland (Dublin)' },
  { value: 'Europe/Paris', label: 'Central Europe (Paris)' },
  { value: 'America/New_York', label: 'US Eastern (New York)' },
  { value: 'America/Chicago', label: 'US Central (Chicago)' },
  { value: 'America/Denver', label: 'US Mountain (Denver)' },
  { value: 'America/Los_Angeles', label: 'US Pacific (Los Angeles)' },
  { value: 'America/Toronto', label: 'Canada Eastern (Toronto)' },
  { value: 'America/Vancouver', label: 'Canada Pacific (Vancouver)' },
  { value: 'Asia/Dubai', label: 'Gulf (Dubai)' },
  { value: 'Asia/Kolkata', label: 'India (Kolkata)' },
  { value: 'Australia/Sydney', label: 'Australia (Sydney)' },
  { value: 'Pacific/Auckland', label: 'New Zealand (Auckland)' },
];

export function isValidTimeZone(value) {
  if (!value || value === DEVICE_TIMEZONE) return value === DEVICE_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function resolveTimezone(stored) {
  const raw = String(stored || '').trim();
  if (!raw || raw === DEFAULT_TIMEZONE) return DEFAULT_TIMEZONE;
  if (raw === DEVICE_TIMEZONE) return deviceTimeZone();
  return isValidTimeZone(raw) ? raw : DEFAULT_TIMEZONE;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function normalizeHm(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '12:00';
  return `${pad2(Number(match[1]))}:${match[2]}`;
}

function partsInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Instant for a wall-clock date/time in a named zone. */
export function zonedTimeToUtc(ymd, hm, timeZone) {
  const [year, month, day] = String(ymd || '').split('-').map(Number);
  const [hour, minute] = normalizeHm(hm).split(':').map(Number);
  if (!year || !month || !day) return null;
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i += 1) {
    const shown = partsInZone(new Date(utc), timeZone);
    const asUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    const diff = asUtc - Date.UTC(year, month - 1, day, hour, minute, 0);
    utc -= diff;
    const check = partsInZone(new Date(utc), timeZone);
    if (
      check.year === year
      && check.month === month
      && check.day === day
      && check.hour === hour
      && check.minute === minute
    ) break;
  }
  return new Date(utc);
}

export function parseSourceDateTime(ymd, hm = '12:00') {
  if (!ymd) return null;
  const date = String(ymd).slice(0, 10);
  return zonedTimeToUtc(date, hm, SOURCE_TIMEZONE);
}

export function formatYmdInTz(date, timeZone = DEFAULT_TIMEZONE) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatHmInTz(date, timeZone = DEFAULT_TIMEZONE) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value || '00';
  const minute = parts.find((part) => part.type === 'minute')?.value || '00';
  return `${hour === '24' ? '00' : hour}:${minute}`;
}

export function formatTimezoneAbbr(timeZone = DEFAULT_TIMEZONE, date = new Date()) {
  if (timeZone === SOURCE_TIMEZONE) return 'SAST';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    }).formatToParts(date);
    return parts.find((part) => part.type === 'timeZoneName')?.value || timeZone;
  } catch {
    return timeZone === DEFAULT_TIMEZONE ? 'SAST' : timeZone;
  }
}

export function displayYmdForSource(ymd, hm, timeZone = DEFAULT_TIMEZONE) {
  const instant = parseSourceDateTime(ymd, hm || '12:00');
  return instant ? formatYmdInTz(instant, timeZone) : String(ymd || '').slice(0, 10);
}

let displayTimeZone = DEFAULT_TIMEZONE;

export function setDisplayTimeZone(timeZone) {
  displayTimeZone = resolveTimezone(timeZone);
  return displayTimeZone;
}

export function getDisplayTimeZone() {
  return displayTimeZone || DEFAULT_TIMEZONE;
}
