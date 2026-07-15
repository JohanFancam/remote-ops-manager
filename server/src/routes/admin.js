import { Router } from 'express';
import { db, newId, nowIso, getSetting, setSetting } from '../db.js';
import {
  authRequired,
  requirePerm,
  requireActive,
  requireRoles,
  hashPassword,
  publicUser,
} from '../middleware/auth.js';
import { PERMISSIONS, ROLES, normalizeRole } from '../permissions.js';
import {
  getAccountsDashboard,
  getOperatorEarnings,
  markMonthPaid,
  markMonthUnpaid,
  updateAccountsNote,
  exportMonthCsv,
} from '../services/pay.js';

const router = Router();

/* ---------- Users ---------- */
router.get('/users', authRequired, requireActive, requirePerm(PERMISSIONS.USER_MANAGE), (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const role = req.query.role;
  const active = req.query.active;
  let sql = `SELECT id, email, full_name, role, active, created_at, updated_at FROM users WHERE 1=1`;
  const params = [];
  if (q) {
    sql += ` AND (lower(email) LIKE ? OR lower(full_name) LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }
  if (role) {
    sql += ` AND role = ?`;
    params.push(role);
  }
  if (active === '1' || active === '0') {
    sql += ` AND active = ?`;
    params.push(Number(active));
  }
  sql += ` ORDER BY full_name`;
  const users = db.prepare(sql).all(...params).map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: normalizeRole(u.role),
    active: !!u.active,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  }));
  res.json({ users });
});

router.post('/users', authRequired, requireActive, requirePerm(PERMISSIONS.USER_MANAGE), (req, res) => {
  const { email, fullName, role, password } = req.body || {};
  if (!email || !fullName || !role) {
    return res.status(400).json({ error: 'email, fullName, role required' });
  }
  const r = normalizeRole(role);
  if (![ROLES.ADMIN, ROLES.OPERATOR, ROLES.ACCOUNTS].includes(r)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const id = newId();
  const pw = hashPassword(password || 'changeme123');
  try {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, role, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, email.trim().toLowerCase(), pw, fullName, r, nowIso(), nowIso());
  } catch {
    return res.status(409).json({ error: 'Email already exists' });
  }
  res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
});

router.patch('/users/:id', authRequired, requireActive, requirePerm(PERMISSIONS.USER_MANAGE), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { fullName, role, active } = req.body || {};

  let nextRole = role ? normalizeRole(role) : user.role;
  let nextActive = active === undefined ? user.active : active ? 1 : 0;

  if (user.role === 'admin' && (nextRole !== 'admin' || !nextActive)) {
    const adminCount = db.prepare(
      `SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1 AND id != ?`
    ).get(user.id).c;
    if (adminCount === 0) {
      return res.status(400).json({ error: 'Cannot deactivate or demote the final active admin' });
    }
  }

  db.prepare(`
    UPDATE users SET full_name = ?, role = ?, active = ?, updated_at = ? WHERE id = ?
  `).run(fullName ?? user.full_name, nextRole, nextActive, nowIso(), user.id);

  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)));
});

router.get('/operators', authRequired, requireActive, requirePerm(PERMISSIONS.ASSIGN_MANUAL), (_req, res) => {
  const users = db.prepare(`
    SELECT id, email, full_name FROM users
    WHERE role = 'operator' AND active = 1 ORDER BY full_name
  `).all();
  res.json(users.map((u) => ({ id: u.id, email: u.email, fullName: u.full_name })));
});

/* ---------- Settings ---------- */
router.get('/settings', authRequired, requireActive, requirePerm(PERMISSIONS.SETTINGS_MANAGE), (_req, res) => {
  res.json({
    applicationName: getSetting('application_name', 'Remote Ops Manager'),
    applicationLogo: getSetting('application_logo', null),
    currency: getSetting('currency', 'ZAR'),
    baseRate: getSetting('base_rate', 1000),
    additionalRate: getSetting('additional_rate', 250),
    preApprovedLimit: getSetting('pre_approved_limit', 6),
    autoPairTeams: getSetting('auto_pair_teams', ['Reds', 'Red Sox', 'Rangers']),
    autoPairWindowMinutes: getSetting('auto_pair_window_minutes', 120),
    autoPairEligibleOperatorIds: getSetting('auto_pair_eligible_operator_ids', null),
    notificationLeadHours: getSetting('notification_lead_hours', 48),
  });
});

router.put('/settings', authRequired, requireActive, requirePerm(PERMISSIONS.SETTINGS_MANAGE), (req, res) => {
  const b = req.body || {};
  const map = {
    applicationName: 'application_name',
    applicationLogo: 'application_logo',
    currency: 'currency',
    baseRate: 'base_rate',
    additionalRate: 'additional_rate',
    preApprovedLimit: 'pre_approved_limit',
    autoPairTeams: 'auto_pair_teams',
    autoPairWindowMinutes: 'auto_pair_window_minutes',
    autoPairEligibleOperatorIds: 'auto_pair_eligible_operator_ids',
    notificationLeadHours: 'notification_lead_hours',
  };
  for (const [k, sk] of Object.entries(map)) {
    if (b[k] !== undefined) setSetting(sk, b[k]);
  }
  res.json({ ok: true });
});

/* ---------- Availability ---------- */
router.get('/availability', authRequired, requireActive, (req, res) => {
  const role = normalizeRole(req.user.role);
  const start = req.query.start;
  const end = req.query.end;
  if (role === ROLES.ADMIN) {
    const rows = db.prepare(`
      SELECT oa.*, u.full_name, u.email FROM operator_availability oa
      JOIN users u ON u.id = oa.operator_id
      WHERE (? IS NULL OR oa.date >= ?) AND (? IS NULL OR oa.date <= ?)
      ORDER BY oa.date
    `).all(start || null, start || null, end || null, end || null);
    return res.json(rows);
  }
  const rows = db.prepare(`
    SELECT * FROM operator_availability WHERE operator_id = ?
      AND (? IS NULL OR date >= ?) AND (? IS NULL OR date <= ?)
  `).all(req.user.id, start || null, start || null, end || null, end || null);
  res.json(rows);
});

router.post('/availability', authRequired, requireActive, requirePerm(PERMISSIONS.AVAIL_OWN), (req, res) => {
  const { date, note } = req.body || {};
  if (!date) return res.status(400).json({ error: 'date required' });
  const id = newId();
  db.prepare(`
    INSERT INTO operator_availability (id, operator_id, date, unavailable, optional_note, created_at)
    VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(operator_id, date) DO UPDATE SET unavailable = 1, optional_note = excluded.optional_note
  `).run(id, req.user.id, date, note || null, nowIso());
  res.status(201).json({ ok: true });
});

router.delete('/availability/:id', authRequired, requireActive, requirePerm(PERMISSIONS.AVAIL_OWN), (req, res) => {
  const row = db.prepare('SELECT * FROM operator_availability WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.operator_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  db.prepare('DELETE FROM operator_availability WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

/* ---------- Pay ---------- */
router.get('/pay', authRequired, requireActive, (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const role = normalizeRole(req.user.role);
  if (role === ROLES.OPERATOR) {
    return res.json({ mode: 'earnings', ...getOperatorEarnings(req.user.id, month) });
  }
  if (role === ROLES.ACCOUNTS || role === ROLES.ADMIN) {
    return res.json({
      mode: 'settle',
      canSettle: role === ROLES.ACCOUNTS,
      ...getAccountsDashboard(month),
    });
  }
  return res.status(403).json({ error: 'Access denied' });
});

router.post('/pay/mark-paid', authRequired, requireActive, requireRoles(ROLES.ACCOUNTS), (req, res) => {
  try {
    const { operatorId, periodMonth, paidDate, note } = req.body || {};
    const dash = markMonthPaid({
      operatorId,
      month: periodMonth,
      paidDate,
      note,
      actorId: req.user.id,
    });
    res.json({ ok: true, pay: { mode: 'settle', canSettle: true, ...dash } });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.post('/pay/mark-unpaid', authRequired, requireActive, requireRoles(ROLES.ACCOUNTS), (req, res) => {
  try {
    const { operatorId, periodMonth } = req.body || {};
    const dash = markMonthUnpaid({
      operatorId,
      month: periodMonth,
      actorId: req.user.id,
    });
    res.json({ ok: true, pay: { mode: 'settle', canSettle: true, ...dash } });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.post('/pay/note', authRequired, requireActive, requireRoles(ROLES.ACCOUNTS), (req, res) => {
  try {
    const { operatorId, periodMonth, note } = req.body || {};
    updateAccountsNote({ operatorId, month: periodMonth, note, actorId: req.user.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.get('/pay/export.csv', authRequired, requireActive, requirePerm(PERMISSIONS.PAY_VIEW_ALL), (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const { filename, content } = exportMonthCsv(month);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(content);
});

/* ---------- Notifications / presence ---------- */
router.get('/notifications', authRequired, requireActive, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM notifications WHERE recipient_user_id = ?
    ORDER BY created_at DESC LIMIT 50
  `).all(req.user.id);
  res.json(rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    relatedShootId: n.related_shoot_id,
    read: !!n.read,
    createdAt: n.created_at,
  })));
});

router.post('/notifications/:id/read', authRequired, requireActive, (req, res) => {
  db.prepare(`UPDATE notifications SET read = 1 WHERE id = ? AND recipient_user_id = ?`)
    .run(req.params.id, req.user.id);
  res.json({ ok: true });
});

router.post('/presence/heartbeat', authRequired, (req, res) => {
  db.prepare(`
    INSERT INTO user_presence (user_id, last_seen, online) VALUES (?, ?, 1)
    ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen, online = 1
  `).run(req.user.id, nowIso());
  res.json({ ok: true });
});

export default router;
