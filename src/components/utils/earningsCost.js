import {
  DEFAULT_POSTPONED_RATE,
  normalizeShootStatus,
} from '../../utils/shootStatus.js';

export const DEFAULT_BASE_RATE = 1000;
export const DEFAULT_ADDITIONAL_RATE = 250;
export const DEFAULT_STANDBY_RATE = 500;
export const ADDITIONAL_WINDOW_HOURS = 2;
export { DEFAULT_POSTPONED_RATE };

function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function pairingPoolForDay(dayShots) {
  return dayShots.filter((s) => {
    const st = normalizeShootStatus(s.status);
    return st !== 'cancelled' && st !== 'postponed';
  });
}

/** Fee for one assigned shoot — matches Pending / Approve. */
export function feeForShoot(shoot, {
  record,
  isAdditional,
  baseRate = DEFAULT_BASE_RATE,
  additionalRate = DEFAULT_ADDITIONAL_RATE,
  postponedRate = DEFAULT_POSTPONED_RATE,
} = {}) {
  const status = normalizeShootStatus(shoot.status);
  if (status === 'cancelled') return 0;
  if (status === 'postponed') return postponedRate;
  if (record?.override_fee != null) return Number(record.override_fee) || 0;
  const additional = record?.is_additional != null ? !!record.is_additional : !!isAdditional;
  return additional ? additionalRate : baseRate;
}

export function getAdditionalShootIds(dayShots) {
  const sorted = [...dayShots].sort((a, b) => {
    const ta = timeToMinutes(a.game_time || a.start_time);
    const tb = timeToMinutes(b.game_time || b.start_time);
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return ta - tb;
  });

  const additionalIds = new Set();

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const tPrev = timeToMinutes(prev.game_time || prev.start_time);
    const tCurr = timeToMinutes(curr.game_time || curr.start_time);

    if (tPrev != null && tCurr != null) {
      const diffHours = (tCurr - tPrev) / 60;
      if (diffHours <= ADDITIONAL_WINDOW_HOURS) {
        additionalIds.add(curr.id);
      }
    }
  }

  return additionalIds;
}

export function additionalIdsForShoots(opShoots) {
  const byDate = {};
  opShoots.forEach((s) => {
    if (!s?.date) return;
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });
  const ids = new Set();
  Object.values(byDate).forEach((dayShots) => {
    getAdditionalShootIds(pairingPoolForDay(dayShots)).forEach((id) => ids.add(id));
  });
  return ids;
}

export function operatorStandbySessions(standbyDays = [], email, monthKey) {
  const safe = String(email || '').toLowerCase().trim();
  if (!safe || !monthKey) return [];
  return standbyDays.filter((sd) => {
    const start = sd.start_date || sd.date || '';
    return String(sd.admin_email || '').toLowerCase().trim() === safe && start.startsWith(monthKey);
  });
}

export function operatorStandbyCost(standbyDays, email, monthKey, standbyRate = DEFAULT_STANDBY_RATE) {
  const sessions = operatorStandbySessions(standbyDays, email, monthKey);
  return { count: sessions.length, total: sessions.length * Number(standbyRate || 0), sessions };
}

/** Sum of assigned-shoot fees for one operator in a month (Pending / Approve totals). */
export function operatorAssignedCost(opShoots, opRecords = [], rates = {}) {
  const autoAdditionalIds = additionalIdsForShoots(opShoots);
  const total = opShoots.reduce((sum, shoot) => {
    const rec = opRecords.find((r) => r.shoot_id === shoot.id);
    const isAdditional = rec?.is_additional != null ? rec.is_additional : autoAdditionalIds.has(shoot.id);
    return sum + feeForShoot(shoot, { record: rec, isAdditional, ...rates });
  }, 0);
  return { total, autoAdditionalIds };
}

export function isAwaitingApproval(shoot) {
  return normalizeShootStatus(shoot?.status) !== 'cancelled'
    && (shoot?.pending_operators || []).length > 0;
}

/** Treat pending shoots as assigned so additional pairing uses the same 2-hour rule. */
export function mergeAssignedWithPending(assignedShoots = [], pendingShoots = []) {
  const byId = new Map();
  for (const shoot of assignedShoots) {
    if (shoot?.id) byId.set(shoot.id, shoot);
  }
  for (const shoot of pendingShoots) {
    if (shoot?.id && !byId.has(shoot.id)) byId.set(shoot.id, shoot);
  }
  return [...byId.values()];
}

/**
 * Confirmed assigned cost plus the total if pending shoots are approved.
 * Additional / postponed / cancelled rules match Pending / Approve.
 */
export function operatorProjectedCost(assignedShoots = [], pendingShoots = [], opRecords = [], rates = {}) {
  const current = operatorAssignedCost(assignedShoots, opRecords, rates);
  const combined = mergeAssignedWithPending(assignedShoots, pendingShoots);
  const projected = operatorAssignedCost(combined, opRecords, rates);
  return {
    current: current.total,
    projected: projected.total,
    pendingAdd: projected.total - current.total,
    combined,
    autoAdditionalIds: projected.autoAdditionalIds,
  };
}

export function feeForProjectedShoot(shoot, opRecords = [], autoAdditionalIds = new Set(), rates = {}) {
  const rec = opRecords.find((r) => r.shoot_id === shoot.id);
  const isAdditional = rec?.is_additional != null ? rec.is_additional : autoAdditionalIds.has(shoot.id);
  return feeForShoot(shoot, { record: rec, isAdditional, ...rates });
}

export { timeToMinutes };
