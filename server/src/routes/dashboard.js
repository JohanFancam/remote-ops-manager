import { Router } from 'express';
import { db, todayStr } from '../db.js';
import { authRequired, requirePerm, requireActive } from '../middleware/auth.js';
import { PERMISSIONS, ROLES, normalizeRole, roleLabel } from '../permissions.js';
import {
  serializeShoot,
  advanceShootStatus,
} from '../services/assignments.js';
import { getOperatorEarnings } from '../services/pay.js';
import { getStandbyBanner, getStandbyShootsForAdmin } from '../services/standby.js';

const router = Router();

function monthNow() {
  return todayStr().slice(0, 7);
}

function sortAssignedShoots(shoots) {
  const now = Date.now();
  const today = todayStr();
  const active = [];
  const upcoming = [];
  const past = [];
  for (const s of shoots) {
    if (s.status === 'completed' || s.status === 'cancelled') {
      past.push(s);
      continue;
    }
    const game = new Date(`${s.date}T${s.gameTime || '19:00'}:00`).getTime();
    const setup = s.setupTime
      ? new Date(`${s.date}T${s.setupTime}:00`).getTime()
      : game - 150 * 60000;
    const inProgressStatus = ['setup_started', 'setup_complete', 'game_started'].includes(
      s.status
    );
    const inLiveWindow = now >= setup && now <= game + 6 * 3600000;
    const stillOnCue = s.date <= today && s.status !== 'completed';

    if (inProgressStatus || inLiveWindow || stillOnCue) {
      active.push(s);
    } else if (s.date > today || game >= now - 30 * 60000) {
      upcoming.push(s);
    } else {
      past.push(s);
    }
  }
  const byTime = (a, b) =>
    `${a.date}T${a.setupTime || a.gameTime}`.localeCompare(
      `${b.date}T${b.setupTime || b.gameTime}`
    );
  active.sort(byTime);
  upcoming.sort(byTime);
  past.sort((a, b) => byTime(b, a));
  return { active, upcoming, past, ordered: [...active, ...upcoming] };
}

router.get(
  '/dashboard',
  authRequired,
  requireActive,
  requirePerm(PERMISSIONS.DASHBOARD_OPS),
  (req, res) => {
    const role = normalizeRole(req.user.role);
    const date = req.query.date || todayStr();

    if (role === ROLES.ADMIN) {
      return res.json(buildAdminDashboard(req.user, date));
    }
    return res.json(buildRemoteDashboard(req.user, date));
  }
);

function buildRemoteDashboard(user, date) {
  const assignedRows = db.prepare(`
    SELECT s.* FROM shoots s
    JOIN assignments a ON a.shoot_id = s.id
    WHERE a.operator_id = ? AND a.status = 'assigned'
      AND s.status != 'cancelled'
    ORDER BY s.date, s.game_time
  `).all(user.id);

  const pendingRows = db.prepare(`
    SELECT s.* FROM shoots s
    JOIN assignments a ON a.shoot_id = s.id
    WHERE a.operator_id = ? AND a.status = 'pending'
    ORDER BY s.date, s.game_time
  `).all(user.id);

  const assigned = assignedRows.map((s) => serializeShoot(s, { forUserId: user.id }));
  const pending = pendingRows.map((s) => serializeShoot(s, { forUserId: user.id }));
  const sorted = sortAssignedShoots(assigned);
  const focus = sorted.ordered[0] || null;
  const banner = getStandbyBanner();

  const notifs = db.prepare(`
    SELECT * FROM notifications
    WHERE recipient_user_id = ?
      AND (expires_at IS NULL OR expires_at > datetime('now'))
    ORDER BY created_at DESC LIMIT 20
  `).all(user.id);

  const earnings = getOperatorEarnings(user.id, monthNow());

  return {
    role: 'operator',
    roleLabel: roleLabel('operator'),
    welcome: `Welcome, ${user.full_name}`,
    date,
    banner: {
      standby: banner,
      nextShoot: focus,
    },
    focus,
    assigned: sorted.ordered,
    pending,
    earningsSummary: {
      month: earnings.month,
      total: earnings.total,
      shootCount: earnings.shootCount,
      currency: earnings.currency,
      paid: earnings.paid,
    },
    notifications: notifs.map(mapNotif),
  };
}

function buildAdminDashboard(user, date) {
  const assignedRows = db.prepare(`
    SELECT s.* FROM shoots s
    JOIN assignments a ON a.shoot_id = s.id
    WHERE a.operator_id = ? AND a.status = 'assigned'
      AND s.status != 'cancelled'
    ORDER BY s.date, s.setup_time, s.game_time
  `).all(user.id);

  const assigned = assignedRows.map((s) => serializeShoot(s, { forUserId: user.id }));
  const sorted = sortAssignedShoots(assigned);
  const focus = sorted.ordered[0] || null;
  const banner = getStandbyBanner();

  const standbyShootRows = getStandbyShootsForAdmin(user.id);
  const standbyShoots = standbyShootRows
    .filter((s) => s.status !== 'completed')
    .map((s) => serializeShoot(s, { forUserId: user.id }));

  const month = date.slice(0, 7);
  const monthShoots = db.prepare(`
    SELECT status, COUNT(*) AS c FROM shoots
    WHERE substr(date,1,7) = ? GROUP BY status
  `).all(month);

  const pendingRequests = db.prepare(`
    SELECT a.*, s.title, s.date, s.game_time, s.team_name, u.full_name, u.email
    FROM assignments a
    JOIN shoots s ON s.id = a.shoot_id
    JOIN users u ON u.id = a.operator_id
    WHERE a.status = 'pending'
    ORDER BY a.created_at DESC LIMIT 30
  `).all();

  const notifs = db.prepare(`
    SELECT * FROM notifications
    WHERE recipient_user_id = ?
    ORDER BY created_at DESC LIMIT 20
  `).all(user.id);

  const presence = db.prepare(`
    SELECT u.id, u.full_name, u.role, p.last_seen,
      CASE WHEN p.last_seen IS NOT NULL
        AND (julianday('now') - julianday(p.last_seen)) * 24 * 60 < 3
      THEN 1 ELSE 0 END AS online
    FROM users u
    LEFT JOIN user_presence p ON p.user_id = u.id
    WHERE u.active = 1 AND u.role IN ('admin','operator')
    ORDER BY online DESC, u.full_name
  `).all();

  return {
    role: 'admin',
    roleLabel: roleLabel('admin'),
    welcome: `Welcome, ${user.full_name}`,
    date,
    banner: {
      standby: banner,
      nextShoot: focus,
    },
    focus,
    assigned: sorted.ordered,
    standbyShoots,
    monthlySummary: {
      month,
      byStatus: Object.fromEntries(monthShoots.map((r) => [r.status, r.c])),
      total: monthShoots.reduce((n, r) => n + r.c, 0),
    },
    assignmentNotifications: pendingRequests.map((r) => ({
      assignmentId: r.id,
      shootId: r.shoot_id,
      title: r.title,
      teamName: r.team_name,
      date: r.date,
      gameTime: r.game_time,
      operatorId: r.operator_id,
      operatorName: r.full_name,
      operatorEmail: r.email,
    })),
    notifications: notifs.map(mapNotif),
    presence: presence.map((p) => ({
      id: p.id,
      fullName: p.full_name,
      role: p.role,
      roleLabel: roleLabel(p.role),
      online: !!p.online,
      lastSeen: p.last_seen,
    })),
  };
}

function mapNotif(n) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    relatedShootId: n.related_shoot_id,
    read: !!n.read,
    createdAt: n.created_at,
  };
}

router.post(
  '/shoots/:id/status',
  authRequired,
  requireActive,
  (req, res) => {
    try {
      const shoot = db.prepare('SELECT * FROM shoots WHERE id = ?').get(req.params.id);
      if (!shoot) return res.status(404).json({ error: 'Shoot not found' });

      const role = normalizeRole(req.user.role);
      if (role === ROLES.OPERATOR) {
        const asg = db.prepare(`
          SELECT 1 FROM assignments WHERE shoot_id = ? AND operator_id = ? AND status = 'assigned'
        `).get(shoot.id, req.user.id);
        if (!asg) return res.status(403).json({ error: 'Access denied' });
      } else if (role !== ROLES.ADMIN) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const result = advanceShootStatus({
        shootId: shoot.id,
        status: req.body?.status,
        actorId: req.user.id,
        confirmComplete: !!req.body?.confirmComplete,
      });
      res.json({
        ok: true,
        ...result,
        shoot: serializeShoot(
          db.prepare('SELECT * FROM shoots WHERE id = ?').get(shoot.id),
          { forUserId: req.user.id }
        ),
      });
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message, code: err.code });
    }
  }
);

export default router;
