import { Router } from 'express';
import { db } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  authRequired,
  normalizeEmail,
} from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password || '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    },
  });
});

router.get('/me', authRequired, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    fullName: req.user.full_name,
    role: req.user.role,
  });
});

export default router;
