import {
  DEFAULT_TIMEZONE,
  formatHmInTz,
  formatYmdInTz,
  getDisplayTimeZone,
  parseSourceDateTime,
  SOURCE_TIMEZONE,
} from './timezone.js';

/** Canonical shoot statuses for Remote Ops Manager. */
export const SHOOT_STATUSES = ['upcoming', 'cancelled', 'postponed', 'completed'];

/** Legacy statuses mapped onto the current set. */
export const LEGACY_STATUS_MAP = {
  confirmed: 'upcoming',
  in_progress: 'upcoming',
  canceled: 'cancelled',
};

export const DEFAULT_POSTPONED_RATE = 250;

export function normalizeShootStatus(status) {
  const raw = String(status || 'upcoming').toLowerCase().trim();
  if (LEGACY_STATUS_MAP[raw]) return LEGACY_STATUS_MAP[raw];
  if (SHOOT_STATUSES.includes(raw)) return raw;
  return 'upcoming';
}

export function formatStatusLabel(status) {
  const normalized = normalizeShootStatus(status);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export const SHOOT_STATUS_COLORS = {
  upcoming: 'bg-blue-600/20 text-blue-400 border-blue-800',
  postponed: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  completed: 'bg-gray-500/20 text-slate-400 border-gray-500/30',
  cancelled: 'bg-red-950/40 text-red-400 border-red-800',
};

export const SHOOT_STATUS_DOTS = {
  upcoming: 'bg-blue-600',
  postponed: 'bg-amber-500',
  completed: 'bg-gray-600',
  cancelled: 'bg-red-600',
};

export const ZA_TIMEZONE = DEFAULT_TIMEZONE;

/** South African Rand display. */
export function formatZAR(amount, { withSpace = true } = {}) {
  const n = Number(amount) || 0;
  const formatted = n.toLocaleString('en-ZA');
  return withSpace ? `R ${formatted}` : `R${formatted}`;
}

/** Date string (yyyy-MM-dd) → medium date in the signed-in user's time zone. */
export function formatDateZA(dateStr, options = {}) {
  if (!dateStr) return '—';
  const { time, ...intl } = options;
  const d = dateStr instanceof Date
    ? dateStr
    : String(dateStr).includes('T')
      ? new Date(dateStr)
      : parseSourceDateTime(String(dateStr).slice(0, 10), time || '12:00');
  if (!d || Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-ZA', {
    timeZone: getDisplayTimeZone(),
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...intl,
  });
}

/** Time string HH:mm stored in SAST → 24h display in the user's time zone. */
export function formatTimeZA(timeStr, dateStr = '') {
  if (!timeStr) return '—';
  if (/^\d{1,2}:\d{2}/.test(timeStr)) {
    const sourceDate = dateStr
      ? String(dateStr).slice(0, 10)
      : formatYmdInTz(new Date(), SOURCE_TIMEZONE);
    const d = parseSourceDateTime(sourceDate, timeStr);
    return d ? formatHmInTz(d, getDisplayTimeZone()) : timeStr;
  }
  const d = new Date(timeStr);
  if (Number.isNaN(d.getTime())) return String(timeStr);
  return formatHmInTz(d, getDisplayTimeZone());
}

export function formatDateTimeZA(dateStr, timeStr) {
  if (!dateStr) return formatTimeZA(timeStr);
  const d = parseSourceDateTime(String(dateStr).slice(0, 10), timeStr || '12:00');
  if (!d) return formatDateZA(dateStr);
  const tz = getDisplayTimeZone();
  const datePart = d.toLocaleDateString('en-ZA', {
    timeZone: tz,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  if (!timeStr) return datePart;
  return `${datePart}, ${formatHmInTz(d, tz)}`;
}

/** Assigned tiles grey as soon as the shoot is marked complete. */
export function shouldGreyCompletedShoot(shoot) {
  return normalizeShootStatus(shoot?.status) === 'completed';
}
