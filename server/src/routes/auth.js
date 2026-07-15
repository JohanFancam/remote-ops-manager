import { Router } from 'express';
import { db, setSetting, getSetting, newId, nowIso, todayStr } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  publicUser,
  authRequired,
  requireActive,
} from '../middleware/auth.js';
import { homePathForRole, normalizeRole, ROLES } from '../permissions.js';

const router = Router();

router.post('/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = req.body?.password || '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!user.active) {
    return res.status(403).json({ error: 'Account is inactive', code: 'INACTIVE' });
  }
  // migrate legacy role in response
  if (user.role === 'user') {
    db.prepare(`UPDATE users SET role = 'operator', updated_at = ? WHERE id = ?`).run(nowIso(), user.id);
    user.role = 'operator';
  }
  const token = signToken(user);
  res.json({
    token,
    user: publicUser(user),
    homePath: homePathForRole(user.role),
  });
});

router.get('/me', authRequired, (req, res) => {
  res.json({
    ...publicUser(req.user),
    homePath: homePathForRole(req.user.role),
    appName: getSetting('application_name', 'Remote Ops Manager'),
  });
});

export default router;
