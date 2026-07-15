import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { normalizeRole, roleHas } from '../permissions.js';

const JWT_SECRET = process.env.JWT_SECRET || 'rom-dev-secret-change-me';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function signToken(user) {
  const role = normalizeRole(user.role);
  return jwt.sign(
    { sub: user.id, email: user.email, role, name: user.full_name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: normalizeRole(user.role),
    active: !!user.active,
  };
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : req.query.token || null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare(
      `SELECT id, email, full_name, role, active FROM users WHERE id = ?`
    ).get(payload.sub);
    if (!user) return res.status(401).json({ error: 'User not found' });
    user.role = normalizeRole(user.role);
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requirePerm(...permissions) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const ok = permissions.some((p) => roleHas(req.user.role, p));
    if (!ok) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }
    next();
  };
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const role = normalizeRole(req.user.role);
    if (!roles.includes(role)) {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }
    next();
  };
}

export function requireActive(req, res, next) {
  if (!req.user?.active) {
    return res.status(403).json({ error: 'Account is inactive', code: 'INACTIVE' });
  }
  next();
}
