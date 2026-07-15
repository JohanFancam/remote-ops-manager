import { Router } from 'express';
import { db } from '../db.js';
import { authRequired, normalizeEmail } from '../middleware/auth.js';
import { subscribe } from '../sse.js';
import {
  todayStr,
  serializeShoot,
  shootCueTimes,
  PHASE_LABELS,
} from '../services/domain.js';

const router = Router();

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

router.get('/today', authRequired, (req, res) => {
  const date = req.query.date || todayStr();
  const role = req.user.role;
  const email = normalizeEmail(req.user.email);

  if (role === 'user') {
    return res.json(buildOperatorToday(email, date));
  }
  if (role === 'standby') {
    return res.json(buildStandbyToday(email, date));
  }
  if (role === 'admin') {
    return res.json(buildAdminToday(date));
  }
  // accounts — light today redirecting focus to Pay
  return res.json({
    surface: 'accounts',
    date,
    headline: 'Pay surface',
    message: 'Settle earnings from the Pay tab.',
    focus: null,
  });
});

function buildOperatorToday(email, date) {
  const shoots = db.prepare(`
    SELECT s.*
    FROM shoots s
    JOIN shoot_assignments sa ON sa.shoot_id = s.id
    WHERE sa.operator_email = ?
      AND sa.state = 'assigned'
      AND s.date = ?
      AND s.status NOT IN ('cancelled')
    ORDER BY s.game_time
  `).all(email, date);

  const serialized = shoots.map((s) => {
    const shoot = serializeShoot(s, { email });
    return { ...shoot, cues: shootCueTimes(s) };
  });

  const next =
    serialized.find((s) => s.status !== 'completed' && s.nextPhase) ||
    serialized[0] ||
    null;

  return {
    surface: 'my_cue',
    date,
    brand: 'ROM',
    headline: 'My Cue',
    focus: next
      ? {
          shoot: next,
          countdownTarget: `${date}T${(next.gameTime || '19:00')}:00`,
          primaryPhase: next.nextPhase,
          primaryLabel: next.nextPhase ? PHASE_LABELS[next.nextPhase] : null,
        }
      : null,
    later: serialized.filter((s) => !next || s.id !== next.id),
    rigRecipe: next?.rig || null,
  };
}

function buildStandbyToday(email, date) {
  const shoots = db.prepare(`
    SELECT * FROM shoots
    WHERE date = ? AND status NOT IN ('cancelled')
    ORDER BY game_time
  `).all(date);

  const serialized = shoots.map((s) => serializeShoot(s));
  const unassigned = serialized.filter((s) => s.assignedOperators.length === 0);
  const pending = serialized.filter((s) => s.pendingOperators.length > 0);

  const quota = {
    total: serialized.length,
    covered: serialized.filter((s) => s.assignedOperators.length > 0).length,
    gaps: unassigned.length,
    pending: pending.length,
  };

  const rigTests = db.prepare(`
    SELECT * FROM rig_tests
    WHERE status != 'completed'
      AND scheduled_date <= ?
      AND (due_date IS NULL OR due_date >= ?)
    ORDER BY scheduled_date
  `).all(addDays(date, 7), date);

  const standby = db.prepare(`
    SELECT * FROM standby_windows
    WHERE start_date <= ? AND end_date >= ?
    ORDER BY start_date
  `).all(date, date);

  return {
    surface: 'coverage',
    date,
    brand: 'ROM',
    headline: 'Coverage',
    quota,
    windowShoots: serialized,
    gaps: unassigned,
    pending,
    rigTestsDue: rigTests.map((t) => ({
      id: t.id,
      title: t.title,
      scheduledDate: t.scheduled_date,
      dueDate: t.due_date,
      assignedTo: t.assigned_to,
      status: t.status,
    })),
    standbyOn: standby.map((s) => ({
      adminEmail: s.admin_email,
      adminName: s.admin_name,
      startDate: s.start_date,
      endDate: s.end_date,
    })),
  };
}

function buildAdminToday(date) {
  const shoots = db.prepare(`
    SELECT * FROM shoots
    WHERE date = ? AND status NOT IN ('cancelled')
    ORDER BY game_time
  `).all(date);
  const serialized = shoots.map((s) => serializeShoot(s));

  const unassignedTonight = serialized.filter((s) => s.assignedOperators.length === 0);

  const overCap = db.prepare(`
    SELECT sa.operator_email, COUNT(*) AS cnt, u.full_name
    FROM shoot_assignments sa
    JOIN shoots s ON s.id = sa.shoot_id
    LEFT JOIN users u ON u.email = sa.operator_email
    WHERE sa.state = 'pre_approved'
      AND s.date >= ?
      AND s.status NOT IN ('cancelled', 'completed')
    GROUP BY sa.operator_email
    HAVING cnt > 6
  `).all(date);

  const stuckPhases = serialized.filter((s) => {
    if (s.status === 'completed') return false;
    if (!s.phases.setup_complete) return false;
    const next = s.nextPhase;
    if (!next) return false;
    // stuck if setup done but still upcoming hours after game? soft heuristic:
    // game time passed and not complete
    const now = new Date();
    const game = new Date(`${s.date}T${s.gameTime}:00`);
    return now > game && next !== null && next !== 'shoot_complete';
  });

  const missingRigChecks = db.prepare(`
    SELECT * FROM rig_tests
    WHERE status != 'completed'
      AND (due_date IS NOT NULL AND due_date <= ? OR scheduled_date < ?)
    ORDER BY COALESCE(due_date, scheduled_date)
  `).all(date, date);

  return {
    surface: 'gaps',
    date,
    brand: 'ROM',
    headline: 'Gaps',
    exceptions: {
      unassignedTonight: unassignedTonight.map((s) => ({
        id: s.id,
        title: s.title,
        client: s.client,
        gameTime: s.gameTime,
      })),
      overCapPendings: overCap.map((r) => ({
        email: r.operator_email,
        name: r.full_name,
        count: r.cnt,
      })),
      stuckPhases: stuckPhases.map((s) => ({
        id: s.id,
        title: s.title,
        client: s.client,
        nextPhase: s.nextPhase,
        gameTime: s.gameTime,
      })),
      missingRigChecks: missingRigChecks.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.due_date || t.scheduled_date,
        assignedTo: t.assigned_to,
        status: t.status,
      })),
    },
  };
}

router.get('/today/stream', (req, res, next) => {
  // Allow ?token= for EventSource (no custom headers); prefer Authorization
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return authRequired(req, res, next);
}, (req, res) => {
  const date = req.query.date || todayStr();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`event: connected\ndata: ${JSON.stringify({ date })}\n\n`);
  subscribe(res, { date, userId: req.user.id, role: req.user.role });
});

export default router;
