import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, nowIso, newId, publicUser, parseJson } from './db.js';
import { generatePassword } from './passwords.js';

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

  if (role !== undefined) delete extra.role;
  if (standby !== undefined) delete extra.standby;
  if (inactive !== undefined) delete extra.inactive;
  if (email !== undefined) delete extra.email;
  if (full_name !== undefined) delete extra.full_name;
  delete rest.role;
  delete rest.standby;
  delete rest.inactive;
  delete rest.email;
  delete rest.full_name;

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

export function listUserRows() {
  return db.prepare('SELECT * FROM users ORDER BY lower(email) ASC').all();
}

function issuedEntry(row, password, status) {
  return {
    email: row.email,
    full_name: row.full_name || '',
    role: row.role || 'user',
    password,
    status,
  };
}

export const MIN_PASSWORD_LENGTH = 8;

export function userMustChangePassword(userOrRow) {
  if (!userOrRow) return false;
  if (userOrRow.must_change_password === true || userOrRow.must_change_password === 'true') {
    return true;
  }
  const extra = parseJson(userOrRow.data, {});
  return extra.must_change_password === true || extra.must_change_password === 'true';
}

export function issueNewPassword(userRow) {
  const password = generatePassword();
  updateUser(userRow.id, { password, must_change_password: true });
  return issuedEntry(userRow, password, 'reset');
}

export function createLoginWithGeneratedPassword({
  email,
  full_name = '',
  role = 'user',
  standby = false,
}) {
  const password = generatePassword();
  const user = createUser({
    email,
    password,
    full_name,
    role,
    standby: role === 'standby' || !!standby,
    extra: { must_change_password: true },
  });
  return issuedEntry(user, password, 'new');
}

/**
 * Replace the signed-in user's password. Generated-password logins
 * (must_change_password) may omit currentPassword; everyone else must
 * prove they know the existing one.
 */
export function changePassword(userRow, { currentPassword = '', newPassword = '' } = {}) {
  if (!userRow) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const next = String(newPassword || '');
  if (next.length < MIN_PASSWORD_LENGTH) {
    const err = new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    err.status = 400;
    throw err;
  }

  const forced = userMustChangePassword(userRow);
  const current = String(currentPassword || '');
  if (!forced || current) {
    if (!current) {
      const err = new Error('Current password required');
      err.status = 400;
      throw err;
    }
    if (!verifyPassword(current, userRow.password_hash)) {
      const err = new Error('Current password is incorrect');
      err.status = 401;
      throw err;
    }
  }

  if (verifyPassword(next, userRow.password_hash)) {
    const err = new Error('Choose a different password from the one you signed in with');
    err.status = 400;
    throw err;
  }

  return updateUser(userRow.id, { password: next, must_change_password: false });
}

/**
 * Re-issue unique random passwords. Hashed in the database; plaintext only
 * in the returned `issued` list (shown once to the admin).
 *
 * @param {object} options
 * @param {string[] | null} [options.emails] emails to reset; omit/null = every login
 * @param {string} [options.skipEmail] usually the admin running the request
 * @param {boolean} [options.includeSkipEmail] also reset skipEmail
 * @param {boolean} [options.allowCreate] create a login when the email has none
 * @param {Record<string, { full_name?: string, role?: string, inactive?: boolean }>} [options.createFrom]
 */
export function resetLoginPasswords({
  emails = null,
  skipEmail = '',
  includeSkipEmail = false,
  allowCreate = false,
  createFrom = {},
} = {}) {
  const skip = includeSkipEmail ? '' : String(skipEmail || '').trim().toLowerCase();
  const rows = listUserRows();
  const byEmail = new Map(rows.map((r) => [String(r.email).toLowerCase(), r]));
  const selected = emails == null
    ? rows.map((r) => String(r.email).toLowerCase())
    : emails.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean);

  const seen = new Set();
  const issued = [];
  const skipped = [];

  for (const email of selected) {
    if (!email || seen.has(email)) continue;
    seen.add(email);

    const row = byEmail.get(email);
    const pending = createFrom[email] || {};

    if (row) {
      if (row.inactive) {
        skipped.push({ email, reason: 'inactive' });
        continue;
      }
      if (skip && email === skip) {
        skipped.push({ email, reason: 'self' });
        continue;
      }
      issued.push(issueNewPassword(row));
      continue;
    }

    if (pending.inactive) {
      skipped.push({ email, reason: 'inactive' });
      continue;
    }
    if (allowCreate) {
      issued.push(createLoginWithGeneratedPassword({
        email,
        full_name: pending.full_name || '',
        role: pending.role || 'user',
        standby: pending.role === 'standby',
      }));
      continue;
    }
    skipped.push({ email, reason: 'not_found' });
  }

  return { issued, skipped };
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
