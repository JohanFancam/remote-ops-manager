import {
  db,
  withTransaction,
  getSetting,
  newId,
  nowIso,
  timeToMinutes,
} from '../db.js';
import { ROLES, normalizeRole } from '../permissions.js';

export const DEFAULT_BASE_RATE = 1000;
export const DEFAULT_ADDITIONAL_RATE = 250;
export const ADDITIONAL_WINDOW_HOURS = 2;

export function getRates() {
  return {
    baseRate: Number(getSetting('base_rate', DEFAULT_BASE_RATE)),
    additionalRate: Number(getSetting('additional_rate', DEFAULT_ADDITIONAL_RATE)),
    currency: getSetting('currency', 'ZAR'),
  };
}

function getAdditionalShootIds(dayShots) {
  const sorted = [...dayShots].sort(
    (a, b) => timeToMinutes(a.game_time) - timeToMinutes(b.game_time)
  );
  const ids = new Set();
  for (let i = 1; i < sorted.length; i++) {
    const diff =
      (timeToMinutes(sorted[i].game_time) - timeToMinutes(sorted[i - 1].game_time)) / 60;
    if (diff <= ADDITIONAL_WINDOW_HOURS) ids.add(sorted[i].id);
  }
  return ids;
}

/**
 * Calculate earnings for an operator in a month from assigned shoots only.
 * Honour assignment.is_additional and payment_line_overrides.
 */
export function calculateOperatorMonth(operatorId, month, { rates = null } = {}) {
  const { baseRate, additionalRate, currency } = rates || getRates();

  const shoots = db.prepare(`
    SELECT s.*, a.is_additional AS asg_additional, a.id AS assignment_id
    FROM shoots s
    JOIN assignments a ON a.shoot_id = s.id
    WHERE a.operator_id = ?
      AND a.status = 'assigned'
      AND s.status != 'cancelled'
      AND substr(s.date, 1, 7) = ?
    ORDER BY s.date, s.game_time
  `).all(operatorId, month);

  const overrides = db.prepare(`
    SELECT * FROM payment_line_overrides
    WHERE operator_id = ? AND period_month = ?
  `).all(operatorId, month);
  const overrideByShoot = Object.fromEntries(overrides.map((o) => [o.shoot_id, o]));

  const byDate = {};
  for (const s of shoots) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  }

  const lines = [];
  let total = 0;

  for (const [, dayShots] of Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))) {
    const flagged = new Set(dayShots.filter((s) => s.asg_additional).map((s) => s.id));
    const proximity = getAdditionalShootIds(dayShots.filter((s) => !flagged.has(s.id)));

    for (const shoot of dayShots) {
      const ov = overrideByShoot[shoot.id];
      let isAdditional =
        ov?.is_additional_override != null
          ? !!ov.is_additional_override
          : flagged.has(shoot.id) || proximity.has(shoot.id);
      let fee =
        ov?.fee_override != null
          ? Number(ov.fee_override)
          : isAdditional
            ? additionalRate
            : baseRate;

      total += fee;
      lines.push({
        shootId: shoot.id,
        title: shoot.title,
        teamName: shoot.team_name,
        date: shoot.date,
        gameTime: shoot.game_time,
        isAdditional,
        fee,
        overridden: !!ov,
      });
    }
  }

  return { total, lines, baseRate, additionalRate, currency, shootCount: lines.length };
}

export function ensureMonthRecord(operatorId, month) {
  const existing = db.prepare(
    `SELECT * FROM payment_records WHERE operator_id = ? AND period_month = ?`
  ).get(operatorId, month);

  // If already finalised/paid, keep snapshot amount
  if (existing?.paid || existing?.finalised_at) {
    return existing;
  }

  const calc = calculateOperatorMonth(operatorId, month);
  if (existing) {
    db.prepare(`
      UPDATE payment_records SET amount = ?, base_rate_snapshot = ?, additional_rate_snapshot = ?,
        updated_at = ? WHERE id = ?
    `).run(calc.total, calc.baseRate, calc.additionalRate, nowIso(), existing.id);
    return db.prepare(`SELECT * FROM payment_records WHERE id = ?`).get(existing.id);
  }

  if (calc.shootCount === 0) return null;

  const id = newId();
  db.prepare(`
    INSERT INTO payment_records (
      id, operator_id, period_month, amount, paid,
      base_rate_snapshot, additional_rate_snapshot, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)
  `).run(
    id,
    operatorId,
    month,
    calc.total,
    calc.baseRate,
    calc.additionalRate,
    nowIso(),
    nowIso()
  );
  return db.prepare(`SELECT * FROM payment_records WHERE id = ?`).get(id);
}

export function getAccountsDashboard(month) {
  const operators = db.prepare(`
    SELECT DISTINCT u.id, u.full_name, u.email, u.active
    FROM users u
    JOIN assignments a ON a.operator_id = u.id
    JOIN shoots s ON s.id = a.shoot_id
    WHERE a.status = 'assigned'
      AND s.status != 'cancelled'
      AND substr(s.date, 1, 7) = ?
    UNION
    SELECT u.id, u.full_name, u.email, u.active
    FROM users u
    JOIN payment_records p ON p.operator_id = u.id
    WHERE p.period_month = ?
  `).all(month, month);

  const rows = [];
  let monthlyTotal = 0;
  let paidCount = 0;
  let unpaidCount = 0;

  for (const op of operators) {
    const record = ensureMonthRecord(op.id, month);
    const calc = calculateOperatorMonth(op.id, month);
    const amount = record?.paid || record?.finalised_at ? record.amount : calc.total;
    const paid = !!(record?.paid);
    if (paid) paidCount += 1;
    else unpaidCount += 1;
    monthlyTotal += amount;
    rows.push({
      operatorId: op.id,
      fullName: op.full_name,
      email: op.email,
      active: !!op.active,
      shootCount: calc.shootCount,
      amount,
      paid,
      paidDate: record?.paid_date || null,
      note: record?.note || null,
      paymentRecordId: record?.id || null,
      lines: calc.lines,
    });
  }

  rows.sort((a, b) => a.fullName.localeCompare(b.fullName));

  return {
    month,
    currency: getRates().currency,
    monthlyTotal,
    operatorCount: rows.length,
    paidCount,
    unpaidCount,
    operators: rows,
  };
}

export function getOperatorEarnings(operatorId, month) {
  const calc = calculateOperatorMonth(operatorId, month);
  const record = ensureMonthRecord(operatorId, month);
  return {
    month,
    currency: calc.currency,
    total: record?.paid || record?.finalised_at ? record.amount : calc.total,
    shootCount: calc.shootCount,
    normalCount: calc.lines.filter((l) => !l.isAdditional).length,
    additionalCount: calc.lines.filter((l) => l.isAdditional).length,
    paid: !!(record?.paid),
    paidDate: record?.paid_date || null,
    lines: calc.lines,
  };
}

export function markMonthPaid({
  operatorId,
  month,
  paidDate,
  actorId,
  note = undefined,
}) {
  return withTransaction(() => {
    const actor = db.prepare('SELECT * FROM users WHERE id = ?').get(actorId);
    if (!actor || normalizeRole(actor.role) !== ROLES.ACCOUNTS) {
      const err = new Error('Only Accounts can mark paid');
      err.status = 403;
      throw err;
    }

    const calc = calculateOperatorMonth(operatorId, month);
    let record = ensureMonthRecord(operatorId, month);
    if (!record) {
      // create even if zero? skip
      if (calc.shootCount === 0) {
        const err = new Error('No qualifying shoots for this period');
        err.status = 400;
        throw err;
      }
      record = ensureMonthRecord(operatorId, month);
    }

    const date = paidDate || todayDate();
    db.prepare(`
      UPDATE payment_records SET
        paid = 1,
        paid_date = ?,
        amount = ?,
        note = COALESCE(?, note),
        base_rate_snapshot = ?,
        additional_rate_snapshot = ?,
        finalised_at = ?,
        finalised_by = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      date,
      calc.total,
      note !== undefined ? note : null,
      calc.baseRate,
      calc.additionalRate,
      nowIso(),
      actorId,
      nowIso(),
      record.id
    );

    return getAccountsDashboard(month);
  });
}

export function markMonthUnpaid({ operatorId, month, actorId }) {
  return withTransaction(() => {
    const actor = db.prepare('SELECT * FROM users WHERE id = ?').get(actorId);
    if (!actor || normalizeRole(actor.role) !== ROLES.ACCOUNTS) {
      const err = new Error('Only Accounts can mark unpaid');
      err.status = 403;
      throw err;
    }
    const record = db.prepare(
      `SELECT * FROM payment_records WHERE operator_id = ? AND period_month = ?`
    ).get(operatorId, month);
    if (!record) {
      const err = new Error('Payment record not found');
      err.status = 404;
      throw err;
    }
    // Recalculate live amount after unfinalising
    const calc = calculateOperatorMonth(operatorId, month);
    db.prepare(`
      UPDATE payment_records SET
        paid = 0, paid_date = NULL, finalised_at = NULL, finalised_by = NULL,
        amount = ?, updated_at = ?
      WHERE id = ?
    `).run(calc.total, nowIso(), record.id);
    return getAccountsDashboard(month);
  });
}

export function updateAccountsNote({ operatorId, month, note, actorId }) {
  const actor = db.prepare('SELECT * FROM users WHERE id = ?').get(actorId);
  if (!actor || normalizeRole(actor.role) !== ROLES.ACCOUNTS) {
    const err = new Error('Only Accounts can edit notes');
    err.status = 403;
    throw err;
  }
  ensureMonthRecord(operatorId, month);
  db.prepare(`
    UPDATE payment_records SET note = ?, updated_at = ?
    WHERE operator_id = ? AND period_month = ?
  `).run(note, nowIso(), operatorId, month);
  return { ok: true };
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportMonthCsv(month) {
  const dash = getAccountsDashboard(month);
  const header = ['Operator', 'Email', 'Shoots', 'Amount (ZAR)', 'Paid', 'Paid Date', 'Note'];
  const lines = [header.join(',')];
  for (const op of dash.operators) {
    lines.push(
      [
        csvEscape(op.fullName),
        csvEscape(op.email),
        csvEscape(op.shootCount),
        csvEscape(op.amount),
        csvEscape(op.paid ? 'Yes' : 'No'),
        csvEscape(op.paidDate || ''),
        csvEscape(op.note || ''),
      ].join(',')
    );
  }
  return {
    filename: `Earnings_${month}.csv`,
    content: lines.join('\n') + '\n',
  };
}
