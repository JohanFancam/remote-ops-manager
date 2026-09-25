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

export const ZA_TIMEZONE = 'Africa/Johannesburg';

/** South African Rand display. */
export function formatZAR(amount, { withSpace = true } = {}) {
  const n = Number(amount) || 0;
  const formatted = n.toLocaleString('en-ZA');
  return withSpace ? `R ${formatted}` : `R${formatted}`;
}

/** Date string (yyyy-MM-dd) → en-ZA medium date (Africa/Johannesburg). */
export function formatDateZA(dateStr, options = {}) {
  if (!dateStr) return '—';
  const d = dateStr instanceof Date
    ? dateStr
    : new Date(String(dateStr).includes('T') ? dateStr : `${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-ZA', {
    timeZone: ZA_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

/** Time string HH:mm → en-ZA 24h display. */
export function formatTimeZA(timeStr) {
  if (!timeStr) return '—';
  if (/^\d{1,2}:\d{2}/.test(timeStr)) {
    const [h, m] = timeStr.split(':');
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const d = new Date(timeStr);
  if (Number.isNaN(d.getTime())) return String(timeStr);
  return d.toLocaleTimeString('en-ZA', {
    timeZone: ZA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDateTimeZA(dateStr, timeStr) {
  const datePart = formatDateZA(dateStr);
  if (!timeStr) return datePart;
  return `${datePart}, ${formatTimeZA(timeStr)}`;
}

/** Assigned tiles grey as soon as the shoot is marked complete. */
export function shouldGreyCompletedShoot(shoot) {
  return normalizeShootStatus(shoot?.status) === 'completed';
}
