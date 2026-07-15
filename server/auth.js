import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, nowIso, newId, publicUser, parseJson } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'remote-ops-dev-secret-change-me';
const TOKEN_TTL = process.env.JWT_TTL || '30d';

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email);
}

export function findUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function createUser({ email, password, full_name = '', role = 'user', standby = false, inactive = false, extra = {} }) {
  const id = newId();
  const ts = nowIso();
  db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, role, standby, inactive, data, created_date, updated_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    email.trim().toLowerCase(),
    hashPassword(password),
    full_name,
    role,
    standby ? 1 : 0,
    inactive ? 1 : 0,
    JSON.stringify(extra),
    ts,
    ts
  );
  return publicUser(findUserById(id));
}

export function updateUser(id, patch = {}) {
  const row = findUserById(id);
  if (!row) return null;

  const extra = parseJson(row.data, {});
  const {
    password,
    email,
    full_name,
    role,
    standby,
    inactive,
    ...rest
  } = patch;

  const next = {
    email: email !== undefined ? String(email).trim().toLowerCase() : row.email,
    full_name: full_name !== undefined ? full_name : row.full_name,
    role: role !== undefined ? role : row.role,
    standby: standby !== undefined ? (standby ? 1 : 0) : row.standby,
    inactive: inactive !== undefined ? (inactive ? 1 : 0) : row.inactive,
    data: JSON.stringify({ ...extra, ...rest }),
    updated_date: nowIso(),
  };

  if (password) {
    db.prepare(`
      UPDATE users
      SET email = ?, password_hash = ?, full_name = ?, role = ?, standby = ?, inactive = ?, data = ?, updated_date = ?
      WHERE id = ?
    `).run(next.email, hashPassword(password), next.full_name, next.role, next.standby, next.inactive, next.data, next.updated_date, id);
  } else {
    db.prepare(`
      UPDATE users
      SET email = ?, full_name = ?, role = ?, standby = ?, inactive = ?, data = ?, updated_date = ?
      WHERE id = ?
    `).run(next.email, next.full_name, next.role, next.standby, next.inactive, next.data, next.updated_date, id);
  }

  return publicUser(findUserById(id));
}

export function listUsers() {
  return db.prepare('SELECT * FROM users ORDER BY created_date DESC').all().map(publicUser);
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : (req.query?.access_token || req.cookies?.token || null);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required', status: 401 });
  }
  try {
    const payload = verifyToken(token);
    const user = findUserById(payload.sub);
    if (!user || user.inactive) {
      return res.status(401).json({ error: 'Invalid token', status: 401 });
    }
    req.user = publicUser(user);
    req.userRow = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token', status: 401 });
  }
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.cookies?.token || null);
  if (token) {
    try {
      const payload = verifyToken(token);
      const user = findUserById(payload.sub);
      if (user && !user.inactive) {
        req.user = publicUser(user);
        req.userRow = user;
      }
    } catch {
      // ignore
    }
  }
  next();
}
