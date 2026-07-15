import { db, getSetting } from '../db.js';
import { normalizeEmail } from '../middleware/auth.js';
import { timeToMinutes } from './domain.js';

export const DEFAULT_BASE_RATE = 1000;
export const DEFAULT_ADDITIONAL_RATE = 250;
export const ADDITIONAL_WINDOW_HOURS = 2;

function getAdditionalShootIds(dayShots) {
  const sorted = [...dayShots].sort(
    (a, b) => timeToMinutes(a.game_time) - timeToMinutes(b.game_time)
  );
  const additionalIds = new Set();
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const diffHours = (timeToMinutes(curr.game_time) - timeToMinutes(prev.game_time)) / 60;
    if (diffHours <= ADDITIONAL_WINDOW_HOURS) {
      additionalIds.add(curr.id);
    }
  }
  return additionalIds;
}

export function calculateOperatorEarnings(operatorEmail, { month = null } = {}) {
  const email = normalizeEmail(operatorEmail);
  const baseRate = getSetting('base_rate', DEFAULT_BASE_RATE);
  const additionalRate = getSetting('additional_rate', DEFAULT_ADDITIONAL_RATE);

  let sql = `
    SELECT s.*, sa.auto_paired
    FROM shoots s
    JOIN shoot_assignments sa ON sa.shoot_id = s.id
    WHERE sa.operator_email = ?
      AND sa.state = 'assigned'
      AND s.status != 'cancelled'
  `;
  const params = [email];
  if (month) {
    sql += ` AND substr(s.date, 1, 7) = ?`;
    params.push(month);
  }
  sql += ` ORDER BY s.date, s.game_time`;

  const assigned = db.prepare(sql).all(...params);
  const byDate = {};
  for (const s of assigned) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  }

  let total = 0;
  const breakdown = [];

  for (const [date, dayShots] of Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))) {
    const autoAdditionalIds = new Set(
      dayShots.filter((s) => s.auto_paired).map((s) => s.id)
    );
    const nonAuto = dayShots.filter((s) => !autoAdditionalIds.has(s.id));
    const proximityAdditionalIds = getAdditionalShootIds(nonAuto);

    for (const shoot of dayShots) {
      const isAdditional =
        autoAdditionalIds.has(shoot.id) || proximityAdditionalIds.has(shoot.id);
      const amount = isAdditional ? additionalRate : baseRate;
      total += amount;
      breakdown.push({
        date,
        shootId: shoot.id,
        title: shoot.title,
        client: shoot.client,
        gameTime: shoot.game_time,
        amount,
        isAdditional,
      });
    }
  }

  return { total, breakdown, baseRate, additionalRate };
}

export function ensurePayRecordsForMonth(month) {
  const baseRate = getSetting('base_rate', DEFAULT_BASE_RATE);
  const additionalRate = getSetting('additional_rate', DEFAULT_ADDITIONAL_RATE);

  const operators = db.prepare(`
    SELECT DISTINCT sa.operator_email, u.full_name
    FROM shoot_assignments sa
    JOIN shoots s ON s.id = sa.shoot_id
    LEFT JOIN users u ON u.email = sa.operator_email
    WHERE sa.state = 'assigned'
      AND s.status != 'cancelled'
      AND substr(s.date, 1, 7) = ?
  `).all(month);

  for (const op of operators) {
    const { breakdown } = calculateOperatorEarnings(op.operator_email, { month });
    for (const row of breakdown) {
      const existing = db.prepare(
        'SELECT id FROM pay_records WHERE operator_email = ? AND shoot_id = ?'
      ).get(normalizeEmail(op.operator_email), row.shootId);
      if (existing) continue;
      db.prepare(`
        INSERT INTO pay_records (
          id, operator_email, operator_name, period_month, shoot_id,
          shoot_title, shoot_date, is_additional, base_fee, paid
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        crypto.randomUUID(),
        normalizeEmail(op.operator_email),
        op.full_name || op.operator_email,
        month,
        row.shootId,
        row.title,
        row.date,
        row.isAdditional ? 1 : 0,
        row.isAdditional ? additionalRate : baseRate
      );
    }
  }
}

export function getPaySurface(user, month) {
  ensurePayRecordsForMonth(month);
  const isSettleRole = user.role === 'admin' || user.role === 'accounts';

  if (isSettleRole) {
    const records = db.prepare(`
      SELECT * FROM pay_records
      WHERE period_month = ?
      ORDER BY operator_email, shoot_date, shoot_title
    `).all(month);

    const byOperator = {};
    for (const r of records) {
      if (!byOperator[r.operator_email]) {
        byOperator[r.operator_email] = {
          email: r.operator_email,
          name: r.operator_name,
          unpaid: 0,
          paid: 0,
          lines: [],
        };
      }
      const fee = r.override_fee ?? r.base_fee;
      if (r.paid) byOperator[r.operator_email].paid += fee;
      else byOperator[r.operator_email].unpaid += fee;
      byOperator[r.operator_email].lines.push({
        id: r.id,
        shootId: r.shoot_id,
        title: r.shoot_title,
        date: r.shoot_date,
        isAdditional: !!r.is_additional,
        fee,
        paid: !!r.paid,
        paidDate: r.paid_date,
      });
    }
    return {
      mode: 'settle',
      month,
      operators: Object.values(byOperator),
    };
  }

  const records = db.prepare(`
    SELECT * FROM pay_records
    WHERE period_month = ? AND operator_email = ?
    ORDER BY shoot_date
  `).all(month, normalizeEmail(user.email));

  let unpaid = 0;
  let paid = 0;
  const lines = records.map((r) => {
    const fee = r.override_fee ?? r.base_fee;
    if (r.paid) paid += fee;
    else unpaid += fee;
    return {
      id: r.id,
      shootId: r.shoot_id,
      title: r.shoot_title,
      date: r.shoot_date,
      isAdditional: !!r.is_additional,
      fee,
      paid: !!r.paid,
      paidDate: r.paid_date,
    };
  });

  return {
    mode: 'earnings',
    month,
    unpaid,
    paid,
    total: unpaid + paid,
    lines,
  };
}
