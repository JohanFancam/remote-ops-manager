import { db, newId, nowIso, todayStr } from '../db.js';

function parseDt(date, time, fallbackTime) {
  const t = time || fallbackTime;
  return new Date(`${date}T${t.length === 5 ? `${t}:00` : t}`);
}

export function listStandbyDays({ from, to } = {}) {
  const start = from || todayStr(new Date(Date.now() - 7 * 86400000));
  const end = to || todayStr(new Date(Date.now() + 60 * 86400000));
  return db
    .prepare(
      `
    SELECT sd.*, u.full_name, u.email
    FROM standby_days sd
    JOIN users u ON u.id = sd.admin_id
    WHERE sd.end_date >= ? AND sd.start_date <= ?
    ORDER BY sd.start_date, sd.start_time
  `
    )
    .all(start, end)
    .map(serializeStandby);
}

export function serializeStandby(row) {
  return {
    id: row.id,
    startDate: row.start_date,
    startTime: row.start_time || '08:00',
    endDate: row.end_date || row.start_date,
    endTime: row.end_time || '23:59',
    adminId: row.admin_id,
    adminName: row.full_name || row.admin_name,
    adminEmail: row.email || row.admin_email,
    notes: row.notes || null,
    createdAt: row.created_at,
  };
}

export function getStandbyBanner(now = new Date()) {
  const rows = db
    .prepare(
      `
    SELECT sd.*, u.full_name, u.email
    FROM standby_days sd
    JOIN users u ON u.id = sd.admin_id
    ORDER BY sd.start_date, sd.start_time
  `
    )
    .all()
    .map(serializeStandby);

  const current = rows.filter((s) => {
    const start = parseDt(s.startDate, s.startTime, '08:00');
    const end = parseDt(s.endDate, s.endTime, '23:59');
    return now >= start && now <= end;
  });

  const next = rows
    .filter((s) => parseDt(s.startDate, s.startTime, '08:00') > now)
    .sort(
      (a, b) =>
        parseDt(a.startDate, a.startTime, '08:00') -
        parseDt(b.startDate, b.startTime, '08:00')
    )[0] || null;

  return { current, next };
}

/** Shoots occurring while this admin is on standby (date overlap). */
export function getStandbyShootsForAdmin(adminId, { from, to } = {}) {
  const start = from || todayStr();
  const end = to || todayStr(new Date(Date.now() + 30 * 86400000));
  const periods = db
    .prepare(
      `
    SELECT * FROM standby_days
    WHERE admin_id = ? AND end_date >= ? AND start_date <= ?
    ORDER BY start_date
  `
    )
    .all(adminId, start, end);

  if (!periods.length) return [];

  const shoots = db
    .prepare(
      `
    SELECT * FROM shoots
    WHERE date >= ? AND date <= ? AND status != 'cancelled'
    ORDER BY date, game_time
  `
    )
    .all(start, end);

  return shoots.filter((s) =>
    periods.some((p) => s.date >= p.start_date && s.date <= (p.end_date || p.start_date))
  );
}

export function createStandbyDay({
  adminId,
  startDate,
  startTime = '08:00',
  endDate,
  endTime = '23:59',
  notes = null,
  createdBy,
}) {
  const admin = db.prepare(`SELECT * FROM users WHERE id = ?`).get(adminId);
  if (!admin || admin.role !== 'admin') {
    const err = new Error('Standby must be an admin user');
    err.status = 400;
    throw err;
  }
  const id = newId();
  db.prepare(
    `
    INSERT INTO standby_days (
      id, start_date, start_time, end_date, end_time,
      admin_id, admin_email, admin_name, notes, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    startDate,
    startTime,
    endDate || startDate,
    endTime,
    adminId,
    admin.email,
    admin.full_name,
    notes,
    createdBy || null,
    nowIso(),
    nowIso()
  );
  return listStandbyDays().find((s) => s.id === id);
}

export function deleteStandbyDay(id) {
  const row = db.prepare(`SELECT id FROM standby_days WHERE id = ?`).get(id);
  if (!row) {
    const err = new Error('Standby period not found');
    err.status = 404;
    throw err;
  }
  db.prepare(`DELETE FROM standby_days WHERE id = ?`).run(id);
  return { ok: true };
}
