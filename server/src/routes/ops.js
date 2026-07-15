import { Router } from 'express';
import { db, newId, nowIso, todayStr, getSetting } from '../db.js';
import { authRequired, requirePerm, requireActive, requireRoles } from '../middleware/auth.js';
import { PERMISSIONS, ROLES, normalizeRole } from '../permissions.js';
import {
  serializeShoot,
  selfAssign,
  adminAssign,
  withdraw,
  adminRemove,
  approvePending,
  rejectPending,
  AssignmentError,
  countPreApprovedFuture,
  getPreApproveLimit,
} from '../services/assignments.js';

const router = Router();

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

router.get('/calendar', authRequired, requireActive, requirePerm(PERMISSIONS.CALENDAR_OPS), (req, res) => {
  const start = req.query.start || todayStr();
  const days = Math.min(Number(req.query.days) || 7, 42);
  const end = req.query.end || addDays(start, days - 1);
  const role = normalizeRole(req.user.role);

  let shoots;
  if (role === ROLES.ADMIN) {
    shoots = db.prepare(`
      SELECT * FROM shoots WHERE date >= ? AND date <= ?
      ORDER BY date, setup_time, game_time
    `).all(start, end);
  } else {
    shoots = db.prepare(`
      SELECT DISTINCT s.* FROM shoots s
      LEFT JOIN assignments a ON a.shoot_id = s.id AND a.operator_id = ?
      WHERE s.date >= ? AND s.date <= ?
        AND s.status != 'cancelled'
      ORDER BY s.date, s.game_time
    `).all(req.user.id, start, end);
  }

  const byDate = {};
  for (let i = 0; ; i++) {
    const d = addDays(start, i);
    if (d > end) break;
    byDate[d] = [];
  }
  for (const s of shoots) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(serializeShoot(s, { forUserId: req.user.id }));
  }

  const unavailable = role === ROLES.ADMIN
    ? db.prepare(`
        SELECT oa.*, u.full_name, u.email FROM operator_availability oa
        JOIN users u ON u.id = oa.operator_id
        WHERE oa.date >= ? AND oa.date <= ? AND oa.unavailable = 1
      `).all(start, end)
    : db.prepare(`
        SELECT * FROM operator_availability
        WHERE operator_id = ? AND date >= ? AND date <= ?
      `).all(req.user.id, start, end);

  res.json({
    start,
    end,
    daysByDate: byDate,
    myPreApprovedCount: role === ROLES.OPERATOR ? countPreApprovedFuture(req.user.id) : null,
    preApproveLimit: getPreApproveLimit(),
    unavailable: unavailable.map((u) => ({
      id: u.id,
      operatorId: u.operator_id,
      fullName: u.full_name,
      email: u.email,
      date: u.date,
      note: u.optional_note,
    })),
  });
});

router.get('/shoots/:id', authRequired, requireActive, requirePerm(PERMISSIONS.CALENDAR_OPS), (req, res) => {
  const shoot = db.prepare('SELECT * FROM shoots WHERE id = ?').get(req.params.id);
  if (!shoot) return res.status(404).json({ error: 'Shoot not found' });
  res.json(serializeShoot(shoot, { forUserId: req.user.id }));
});

router.post('/shoots', authRequired, requireActive, requirePerm(PERMISSIONS.SHOOT_CREATE), (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.date) return res.status(400).json({ error: 'title and date required' });
  const id = newId();
  db.prepare(`
    INSERT INTO shoots (
      id, title, team_name, opponent, date, setup_time, game_time, expected_end_time,
      venue, shoot_type, rig_id, status, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)
  `).run(
    id,
    b.title,
    b.teamName || null,
    b.opponent || null,
    b.date,
    b.setupTime || null,
    b.gameTime || '19:00',
    b.expectedEndTime || null,
    b.venue || null,
    b.shootType || 'Data',
    b.rigId || null,
    req.user.id,
    nowIso(),
    nowIso()
  );
  res.status(201).json(serializeShoot(db.prepare('SELECT * FROM shoots WHERE id = ?').get(id)));
});

router.patch('/shoots/:id', authRequired, requireActive, requirePerm(PERMISSIONS.SHOOT_EDIT), (req, res) => {
  const shoot = db.prepare('SELECT * FROM shoots WHERE id = ?').get(req.params.id);
  if (!shoot) return res.status(404).json({ error: 'Shoot not found' });
  const b = req.body || {};
  const fields = {
    title: b.title ?? shoot.title,
    team_name: b.teamName ?? shoot.team_name,
    opponent: b.opponent ?? shoot.opponent,
    date: b.date ?? shoot.date,
    setup_time: b.setupTime ?? shoot.setup_time,
    game_time: b.gameTime ?? shoot.game_time,
    expected_end_time: b.expectedEndTime ?? shoot.expected_end_time,
    venue: b.venue ?? shoot.venue,
    shoot_type: b.shootType ?? shoot.shoot_type,
    rig_id: b.rigId ?? shoot.rig_id,
  };
  db.prepare(`
    UPDATE shoots SET title=?, team_name=?, opponent=?, date=?, setup_time=?, game_time=?,
      expected_end_time=?, venue=?, shoot_type=?, rig_id=?, updated_at=?
    WHERE id=?
  `).run(
    fields.title, fields.team_name, fields.opponent, fields.date, fields.setup_time,
    fields.game_time, fields.expected_end_time, fields.venue, fields.shoot_type,
    fields.rig_id, nowIso(), shoot.id
  );

  // notify assignees on change
  const assignees = db.prepare(
    `SELECT operator_id FROM assignments WHERE shoot_id = ? AND status = 'assigned'`
  ).all(shoot.id);
  for (const a of assignees) {
    db.prepare(`
      INSERT INTO notifications (id, recipient_user_id, type, title, message, related_shoot_id, created_at)
      VALUES (?, ?, 'shoot_changed', 'Shoot updated', ?, ?, ?)
    `).run(newId(), a.operator_id, `${fields.title} was updated`, shoot.id, nowIso());
  }

  res.json(serializeShoot(db.prepare('SELECT * FROM shoots WHERE id = ?').get(shoot.id)));
});

router.post('/shoots/:id/duplicate', authRequired, requireActive, requirePerm(PERMISSIONS.SHOOT_CREATE), (req, res) => {
  const shoot = db.prepare('SELECT * FROM shoots WHERE id = ?').get(req.params.id);
  if (!shoot) return res.status(404).json({ error: 'Shoot not found' });
  const id = newId();
  const date = req.body?.date || shoot.date;
  db.prepare(`
    INSERT INTO shoots (
      id, title, team_name, opponent, date, setup_time, game_time, expected_end_time,
      venue, shoot_type, rig_id, status, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)
  `).run(
    id, shoot.title, shoot.team_name, shoot.opponent, date, shoot.setup_time,
    shoot.game_time, shoot.expected_end_time, shoot.venue, shoot.shoot_type,
    shoot.rig_id, req.user.id, nowIso(), nowIso()
  );
  res.status(201).json(serializeShoot(db.prepare('SELECT * FROM shoots WHERE id = ?').get(id)));
});

router.post('/shoots/:id/cancel', authRequired, requireActive, requirePerm(PERMISSIONS.SHOOT_CANCEL), (req, res) => {
  const shoot = db.prepare('SELECT * FROM shoots WHERE id = ?').get(req.params.id);
  if (!shoot) return res.status(404).json({ error: 'Shoot not found' });
  db.prepare(`UPDATE shoots SET status = 'cancelled', updated_at = ? WHERE id = ?`).run(nowIso(), shoot.id);
  const assignees = db.prepare(
    `SELECT operator_id FROM assignments WHERE shoot_id = ? AND status IN ('assigned','pending')`
  ).all(shoot.id);
  for (const a of assignees) {
    db.prepare(`
      INSERT INTO notifications (id, recipient_user_id, type, title, message, related_shoot_id, created_at)
      VALUES (?, ?, 'shoot_cancelled', 'Shoot cancelled', ?, ?, ?)
    `).run(newId(), a.operator_id, `${shoot.title} was cancelled`, shoot.id, nowIso());
  }
  res.json({ ok: true });
});

router.post('/shoots/import', authRequired, requireActive, requirePerm(PERMISSIONS.SHOOT_IMPORT), (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).json({ error: 'rows array required' });
  }
  let created = 0;
  for (const r of rows) {
    if (!r.title || !r.date) continue;
    db.prepare(`
      INSERT INTO shoots (
        id, title, team_name, opponent, date, setup_time, game_time, venue, shoot_type, status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)
    `).run(
      newId(), r.title, r.teamName || null, r.opponent || null, r.date,
      r.setupTime || null, r.gameTime || '19:00', r.venue || null,
      r.shootType || 'Data', req.user.id, nowIso(), nowIso()
    );
    created += 1;
  }
  res.json({ ok: true, created });
});

function handleAssignError(res, err) {
  res.status(err.status || 400).json({
    error: err.message,
    code: err.code,
    warnings: err.warnings || [],
  });
}

router.post('/shoots/:id/claim', authRequired, requireActive, requirePerm(PERMISSIONS.ASSIGN_SELF), (req, res) => {
  try {
    const result = selfAssign({
      operatorId: req.user.id,
      shootId: req.params.id,
      actorId: req.user.id,
    });
    const shoot = serializeShoot(
      db.prepare('SELECT * FROM shoots WHERE id = ?').get(req.params.id),
      { forUserId: req.user.id }
    );
    res.json({ ok: true, shoot, ...result });
  } catch (err) {
    handleAssignError(res, err);
  }
});

router.post('/shoots/:id/withdraw', authRequired, requireActive, (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    if (role !== ROLES.OPERATOR && role !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const operatorId =
      role === ROLES.ADMIN && req.body?.operatorId
        ? req.body.operatorId
        : req.user.id;
    if (role === ROLES.OPERATOR && operatorId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const result =
      role === ROLES.ADMIN && req.body?.operatorId
        ? adminRemove({ shootId: req.params.id, operatorId, adminId: req.user.id })
        : withdraw({ shootId: req.params.id, operatorId, actorId: req.user.id });
    res.json({ ok: true, ...result });
  } catch (err) {
    handleAssignError(res, err);
  }
});

router.post('/assignments/assign', authRequired, requireActive, requirePerm(PERMISSIONS.ASSIGN_MANUAL), (req, res) => {
  try {
    const { shootId, operatorId, override } = req.body || {};
    if (!shootId || !operatorId) {
      return res.status(400).json({ error: 'shootId and operatorId required' });
    }
    const result = adminAssign({
      shootId,
      operatorId,
      adminId: req.user.id,
      override: !!override,
    });
    res.json({
      ok: true,
      ...result,
      shoot: serializeShoot(db.prepare('SELECT * FROM shoots WHERE id = ?').get(shootId)),
    });
  } catch (err) {
    handleAssignError(res, err);
  }
});

router.post('/assignments/approve', authRequired, requireActive, requirePerm(PERMISSIONS.ASSIGN_APPROVE), (req, res) => {
  try {
    const { shootId, operatorId } = req.body || {};
    const result = approvePending({ shootId, operatorId, adminId: req.user.id });
    res.json({ ok: true, ...result });
  } catch (err) {
    handleAssignError(res, err);
  }
});

router.post('/assignments/reject', authRequired, requireActive, requirePerm(PERMISSIONS.ASSIGN_APPROVE), (req, res) => {
  try {
    const { shootId, operatorId } = req.body || {};
    const result = rejectPending({ shootId, operatorId, adminId: req.user.id });
    res.json({ ok: true, ...result });
  } catch (err) {
    handleAssignError(res, err);
  }
});

export default router;
