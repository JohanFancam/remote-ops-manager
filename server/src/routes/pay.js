import { Router } from 'express';
import { db, withTransaction } from '../db.js';
import { authRequired, requireRoles, normalizeEmail } from '../middleware/auth.js';
import { getPaySurface } from '../services/pay.js';
import { todayStr } from '../services/domain.js';

const router = Router();

router.get('/', authRequired, (req, res) => {
  const month = req.query.month || todayStr().slice(0, 7);
  if (req.user.role === 'standby') {
    return res.status(403).json({ error: 'Standby role has no pay surface' });
  }
  res.json(getPaySurface(req.user, month));
});

router.post('/mark-paid', authRequired, requireRoles('admin', 'accounts'), (req, res) => {
  const { recordIds, periodMonth, operatorEmail } = req.body || {};
  const paidDate = new Date().toISOString().slice(0, 10);

  if (Array.isArray(recordIds) && recordIds.length) {
    const stmt = db.prepare(`
      UPDATE pay_records SET paid = 1, paid_date = ? WHERE id = ? AND paid = 0
    `);
    withTransaction(() => {
      for (const id of recordIds) stmt.run(paidDate, id);
    });
  } else if (periodMonth && operatorEmail) {
    db.prepare(`
      UPDATE pay_records
      SET paid = 1, paid_date = ?
      WHERE period_month = ? AND operator_email = ? AND paid = 0
    `).run(paidDate, periodMonth, normalizeEmail(operatorEmail));
  } else {
    return res.status(400).json({
      error: 'Provide recordIds or periodMonth+operatorEmail',
    });
  }

  const month = periodMonth || todayStr().slice(0, 7);
  res.json({ ok: true, pay: getPaySurface(req.user, month) });
});

router.post('/unmark-paid', authRequired, requireRoles('admin', 'accounts'), (req, res) => {
  const { recordIds } = req.body || {};
  if (!Array.isArray(recordIds) || !recordIds.length) {
    return res.status(400).json({ error: 'recordIds required' });
  }
  const stmt = db.prepare(`UPDATE pay_records SET paid = 0, paid_date = NULL WHERE id = ?`);
  withTransaction(() => {
    for (const id of recordIds) stmt.run(id);
  });
  res.json({ ok: true });
});

export default router;
