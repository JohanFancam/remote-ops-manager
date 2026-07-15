import { Router } from 'express';
import { db, withTransaction } from '../db.js';
import { authRequired, requireRoles, normalizeEmail } from '../middleware/auth.js';
import { broadcastToday } from '../sse.js';
import {
  todayStr,
  serializeShoot,
  getPreApprovedCount,
  AUTO_APPROVE_LIMIT,
  findPairedShoot,
  addAssignment,
  removeOperatorFromShoot,
  operatorOnShoot,
  canAdvancePhase,
  assertPhaseOrder,
  phaseMessage,
  getRigSettingForShoot,
  formatRigRecipe,
  PHASE_LABELS,
} from '../services/domain.js';

const router = Router();

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Week strip board payload */
router.get('/board', authRequired, (req, res) => {
  const start = req.query.start || todayStr();
  const days = Math.min(Number(req.query.days) || 7, 14);
  const end = addDays(start, days - 1);

  const shoots = db.prepare(`
    SELECT * FROM shoots
    WHERE date >= ? AND date <= ? AND status != 'cancelled'
    ORDER BY date, game_time
  `).all(start, end);

  const byDate = {};
  for (let i = 0; i < days; i++) {
    byDate[addDays(start, i)] = [];
  }
  for (const s of shoots) {
    const serialized = serializeShoot(s, { email: req.user.email });
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(serialized);
  }

  const myPreApproved = getPreApprovedCount(req.user.email);
  res.json({
    start,
    end,
    days,
    myPreApprovedCount: myPreApproved,
    preApproveLimit: AUTO_APPROVE_LIMIT,
    daysByDate: byDate,
  });
});

router.post('/shoots/:id/claim', authRequired, (req, res) => {
  const shoot = db.prepare('SELECT * FROM shoots WHERE id = ?').get(req.params.id);
  if (!shoot) return res.status(404).json({ error: 'Shoot not found' });
  if (shoot.status === 'cancelled' || shoot.status === 'completed') {
    return res.status(400).json({ error: 'Shoot is not claimable' });
  }

  const email = normalizeEmail(req.user.email);
  const isStaff = req.user.role === 'admin' || req.user.role === 'standby';
  const targetEmail = isStaff && req.body?.operatorEmail
    ? normalizeEmail(req.body.operatorEmail)
    : email;

  if (!isStaff && req.user.role !== 'user') {
    return res.status(403).json({ error: 'Only operators can self-claim' });
  }
  if (!isStaff && targetEmail !== email) {
    return res.status(403).json({ error: 'Cannot claim for another operator' });
  }

  const existing = operatorOnShoot(shoot.id, targetEmail);
  if (existing.some((a) => a.state === 'assigned' || a.state === 'pending')) {
    return res.status(409).json({ error: 'Already claimed or pending on this shoot' });
  }

  const count = getPreApprovedCount(targetEmail, shoot.id);
  const withinCap = count < AUTO_APPROVE_LIMIT;
  const pair = findPairedShoot(shoot);

  // Cap check includes potential pair slot as pre-approved count for primary only;
  // pair is auto-paired and counts as additional for pay, but pre-approved state
  // is only applied when within cap for self-claim approval path.
  if (!isStaff && !withinCap && !req.body?.forcePending) {
    // Over cap → pending only (await admin approval)
  }

  const result = withTransaction(() => {
    if (isStaff && req.body?.assignDirect) {
      addAssignment(shoot.id, targetEmail, 'assigned');
      addAssignment(shoot.id, targetEmail, 'pre_approved');
      if (pair) {
        addAssignment(pair.id, targetEmail, 'assigned', {
          autoPaired: true,
          pairedShootId: shoot.id,
        });
      }
      return { state: 'assigned', paired: pair ? serializeShoot(pair) : null };
    }

    if (withinCap) {
      addAssignment(shoot.id, targetEmail, 'assigned');
      addAssignment(shoot.id, targetEmail, 'pre_approved');
      let paired = null;
      if (pair) {
        addAssignment(pair.id, targetEmail, 'assigned', {
          autoPaired: true,
          pairedShootId: shoot.id,
        });
        paired = serializeShoot(pair, { email: targetEmail });
      }
      return { state: 'assigned', paired };
    }

    addAssignment(shoot.id, targetEmail, 'pending');
    return { state: 'pending', paired: null, reason: 'Over 6-slot pre-approval cap' };
  });

  broadcastToday(shoot.date, 'shoot_updated', { shootId: shoot.id });
  if (pair) broadcastToday(pair.date, 'shoot_updated', { shootId: pair.id });

  res.json({
    ok: true,
    shoot: serializeShoot(
      db.prepare('SELECT * FROM shoots WHERE id = ?').get(shoot.id),
      { email: targetEmail }
    ),
    ...result,
    preApprovedCount: getPreApprovedCount(targetEmail),
    preApproveLimit: AUTO_APPROVE_LIMIT,
  });
});

router.post('/shoots/:id/unclaim', authRequired, (req, res) => {
  const shoot = db.prepare('SELECT * FROM shoots WHERE id = ?').get(req.params.id);
  if (!shoot) return res.status(404).json({ error: 'Shoot not found' });

  const isStaff = req.user.role === 'admin' || req.user.role === 'standby';
  const targetEmail = isStaff && req.body?.operatorEmail
    ? normalizeEmail(req.body.operatorEmail)
    : normalizeEmail(req.user.email);

  if (!isStaff && targetEmail !== normalizeEmail(req.user.email)) {
    return res.status(403).json({ error: 'Cannot unclaim for another operator' });
  }

  const mine = operatorOnShoot(shoot.id, targetEmail);
  if (!mine.length) {
    return res.status(404).json({ error: 'Not assigned to this shoot' });
  }

  const pairedIds = mine
    .map((a) => a.paired_shoot_id)
    .filter(Boolean);

  // Also find shoots where this was the paired side
  const reversePairs = db.prepare(`
    SELECT shoot_id FROM shoot_assignments
    WHERE operator_email = ? AND paired_shoot_id = ?
  `).all(targetEmail, shoot.id).map((r) => r.shoot_id);

  withTransaction(() => {
    removeOperatorFromShoot(shoot.id, targetEmail);
    for (const pid of [...new Set([...pairedIds, ...reversePairs])]) {
      removeOperatorFromShoot(pid, targetEmail);
    }
  });

  broadcastToday(shoot.date, 'shoot_updated', { shootId: shoot.id });
  res.json({
    ok: true,
    shoot: serializeShoot(
      db.prepare('SELECT * FROM shoots WHERE id = ?').get(shoot.id),
      { email: req.user.email }
    ),
  });
});

router.post('/assignments/approve', authRequired, requireRoles('admin', 'standby'), (req, res) => {
  const { shootId, operatorEmail } = req.body || {};
  if (!shootId || !operatorEmail) {
    return res.status(400).json({ error: 'shootId and operatorEmail required' });
  }
  const email = normalizeEmail(operatorEmail);
  const shoot = db.prepare('SELECT * FROM shoots WHERE id = ?').get(shootId);
  if (!shoot) return res.status(404).json({ error: 'Shoot not found' });

  const pending = operatorOnShoot(shootId, email).find((a) => a.state === 'pending');
  if (!pending) {
    return res.status(404).json({ error: 'No pending assignment for operator' });
  }

  const count = getPreApprovedCount(email, shootId);
  // Admin can approve even over cap, but we still record pre_approved
  // Fail closed for missing shoot / missing pending already handled.

  const pair = findPairedShoot(shoot);
  withTransaction(() => {
    db.prepare(`
      DELETE FROM shoot_assignments WHERE shoot_id = ? AND operator_email = ? AND state = 'pending'
    `).run(shootId, email);
    addAssignment(shootId, email, 'assigned');
    addAssignment(shootId, email, 'pre_approved');
    if (pair) {
      addAssignment(pair.id, email, 'assigned', {
        autoPaired: true,
        pairedShootId: shootId,
      });
    }
  });

  broadcastToday(shoot.date, 'shoot_updated', { shootId });
  res.json({
    ok: true,
    shoot: serializeShoot(db.prepare('SELECT * FROM shoots WHERE id = ?').get(shootId)),
    paired: pair ? serializeShoot(pair) : null,
    preApprovedCount: count + 1,
    warning: count >= AUTO_APPROVE_LIMIT ? 'Operator is over the 6-slot pre-approval cap' : null,
  });
});

router.post('/assignments/reject', authRequired, requireRoles('admin', 'standby'), (req, res) => {
  const { shootId, operatorEmail } = req.body || {};
  if (!shootId || !operatorEmail) {
    return res.status(400).json({ error: 'shootId and operatorEmail required' });
  }
  const email = normalizeEmail(operatorEmail);
  db.prepare(`
    DELETE FROM shoot_assignments
    WHERE shoot_id = ? AND operator_email = ? AND state = 'pending'
  `).run(shootId, email);
  const shoot = db.prepare('SELECT * FROM shoots WHERE id = ?').get(shootId);
  if (shoot) broadcastToday(shoot.date, 'shoot_updated', { shootId });
  res.json({ ok: true });
});

router.post('/shoots/:id/phases/:phase', authRequired, (req, res) => {
  const shoot = db.prepare('SELECT * FROM shoots WHERE id = ?').get(req.params.id);
  if (!shoot) return res.status(404).json({ error: 'Shoot not found' });

  const phase = req.params.phase;
  if (!PHASE_LABELS[phase]) {
    return res.status(400).json({ error: 'Unknown phase' });
  }

  if (!canAdvancePhase(shoot, phase, req.user)) {
    return res.status(403).json({ error: 'Not allowed to advance phase on this shoot' });
  }

  const rig = formatRigRecipe(getRigSettingForShoot(shoot));
  try {
    assertPhaseOrder(shoot.id, phase, rig);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO shoot_phases (shoot_id, phase, completed_at, completed_by)
    VALUES (?, ?, ?, ?)
  `).run(shoot.id, phase, now, req.user.email);

  if (phase === 'setup_complete' || phase === 'pre_shoot_started') {
    db.prepare(`UPDATE shoots SET status = 'in_progress' WHERE id = ? AND status IN ('upcoming','confirmed')`)
      .run(shoot.id);
  }
  if (phase === 'shoot_complete') {
    db.prepare(`UPDATE shoots SET status = 'completed' WHERE id = ?`).run(shoot.id);
  }

  const message = phaseMessage(shoot, phase);
  // Optional webhook stub
  const webhook = process.env.PHASE_WEBHOOK_URL;
  if (webhook) {
    fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shootId: shoot.id, phase, message }),
    }).catch(() => {});
  }

  broadcastToday(shoot.date, 'phase_advanced', {
    shootId: shoot.id,
    phase,
    by: req.user.email,
  });

  const updated = db.prepare('SELECT * FROM shoots WHERE id = ?').get(shoot.id);
  res.json({
    ok: true,
    shoot: serializeShoot(updated, { email: req.user.email }),
    phase,
    completedAt: now,
    message,
  });
});

router.get('/operators', authRequired, requireRoles('admin', 'standby'), (_req, res) => {
  const users = db.prepare(`
    SELECT id, email, full_name, role FROM users
    WHERE role = 'user'
    ORDER BY full_name
  `).all();
  res.json(users.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.full_name,
  })));
});

export default router;
