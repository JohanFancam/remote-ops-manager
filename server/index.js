import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  authMiddleware,
  findUserByEmail,
  verifyPassword,
  signToken,
  createUser,
  updateUser,
  resetLoginPasswords,
  changePassword,
} from './auth.js';
import {
  listEntities,
  filterEntities,
  createEntity,
  updateEntity,
  deleteEntity,
  getEntity,
} from './entities.js';
import { subscribeEntity } from './events.js';
import { seedIfEmpty } from './seed.js';
import { publicUser, ENTITY_TYPES, parseJson, nowIso } from './db.js';
import {
  getGoogleStatus,
  getAuthUrl,
  handleOAuthCallback,
  clearTokens,
  syncGoogleCalendar,
  listGoogleCalendars,
  saveGoogleSettings,
  getGoogleSettings,
  saveOAuthClient,
  maybeRunScheduledGoogleSync,
} from './googleCalendar.js';
import { isAssignmentLocked } from './shootTitleMatch.js';
import { restrictedRemoteAssignError } from './restrictedAssign.js';
import { syncRigChecksForShoot } from './rigChecks.js';
import { validateRigCheckAssignment } from './rigCheckUtils.js';
import {
  getVapidPublicKey,
  savePushSubscription,
  removePushSubscription,
  sendPushToEmails,
} from './push.js';
import {
  handleShootChange,
  handleAvailabilityChange,
  handleStandbyChange,
  notifyAppFault,
  runReminderPass,
  createNotifications,
} from './notifications.js';
import {
  importEntityRows,
  inferEntityType,
  parseFileContents,
  countBrokenShootReferences,
} from './entityImport.js';
import {
  getSlackGamesSettings,
  saveSlackGamesSettings,
  fetchLatestSlackGamesMessage,
  applySlackGames,
  todaySastYmd,
} from './slackCalendar.js';
import {
  getRigCheckSlackSettings,
  saveRigCheckSlackSettings,
  canSendRigCheckMessage,
  postRigCheckToSlack,
} from './slackRigCheck.js';
import { restoreSyncDeletedShoots } from './restoreSyncDeletedShoots.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(__dirname, '../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

seedIfEmpty();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));
app.use('/api/uploads', express.static(uploadsDir));

const ALLOWED_UPLOAD_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/bmp',
]);

function isAllowedUploadImage(file) {
  const type = String(file?.mimetype || '').toLowerCase();
  if (ALLOWED_UPLOAD_TYPES.has(type)) return true;
  const name = String(file?.originalname || '').toLowerCase();
  return /\.(png|jpe?g|webp|gif|svg|ico|bmp)$/.test(name);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedUploadImage(file)) return cb(null, true);
    const err = new Error('Please upload a PNG, JPEG, WebP, GIF, SVG, or ICO image');
    err.status = 400;
    cb(err);
  },
});

// Import files are parsed in memory rather than written to the uploads folder
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'remote-ops-api' });
});

function settingValue(key) {
  const settings = listEntities('AppSettings', null, 500);
  const matches = settings.filter((item) => item.key === key);
  const row = [...matches].reverse().find((item) => String(item.value || '').trim()) || matches[0];
  return String(row?.value || '').trim();
}

function iconMimeFromUrl(url) {
  const lower = String(url || '').toLowerCase();
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
}

function themeHex(key, fallback) {
  const raw = settingValue(key);
  const match = String(raw || '').trim().match(/^#?([0-9a-fA-F]{6})$/);
  return match ? `#${match[1].toLowerCase()}` : fallback;
}

function buildWebManifest() {
  const customLogo = settingValue('app_logo_url');
  const icon = customLogo || '/rom-logo.png';
  const type = iconMimeFromUrl(icon);
  const canvas = themeHex('theme_canvas', '#1f2021');
  return {
    name: 'Remote Ops Manager',
    short_name: 'Remote Ops',
    description: 'Portal for remote operators, standby, and scheduling',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: canvas,
    theme_color: canvas,
    icons: customLogo
      ? [
          { src: icon, sizes: '192x192', type, purpose: 'any' },
          { src: icon, sizes: '512x512', type, purpose: 'any maskable' },
        ]
      : [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
  };
}

app.get('/api/public-settings', (_req, res) => {
  res.json({
    id: 'remote-ops-manager',
    public_settings: {
      app_name: 'Remote Ops Manager',
      auth_required: true,
      login_background_url: settingValue('login_background_url'),
      app_logo_url: settingValue('app_logo_url'),
      splash_image_url: settingValue('splash_image_url'),
      theme_canvas: settingValue('theme_canvas'),
      theme_surface: settingValue('theme_surface'),
      theme_accent: settingValue('theme_accent'),
      theme_line: settingValue('theme_line'),
      crd_google_account: settingValue('crd_google_account'),
    },
  });
});

function sendManifest(_req, res) {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'no-store');
  res.json(buildWebManifest());
}

app.get('/api/manifest.json', sendManifest);
app.get('/manifest.json', sendManifest);

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const row = findUserByEmail(email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (row.inactive) {
    return res.status(403).json({ error: 'Account is inactive' });
  }
  const extra = parseJson(row.data, {});
  const now = nowIso();
  const user = updateUser(row.id, {
    last_login_at: now,
    first_login_at: extra.first_login_at || now,
    awaiting_first_login: false,
  }) || publicUser(row);
  const token = signToken(user);
  res.json({ token, user });
});

app.post('/api/auth/register', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const full_name = String(req.body?.full_name || '').trim();

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (findUserByEmail(email)) {
    return res.status(409).json({ error: 'User already exists' });
  }

  // Prefer role/name from PendingUser invite if present
  const pending = filterEntities('PendingUser', { email }).find((p) => !p.inactive);
  const role = pending?.role || 'user';
  const name = full_name || pending?.full_name || '';

  const now = nowIso();
  const user = createUser({
    email,
    password,
    full_name: name,
    role,
    standby: role === 'standby',
    extra: { last_login_at: now, first_login_at: now, awaiting_first_login: false },
  });
  if (pending?.id) {
    updateEntity('PendingUser', pending.id, { invited: true });
  }
  const token = signToken(user);
  res.status(201).json({ token, user });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

app.patch('/api/auth/me', authMiddleware, (req, res) => {
  const body = { ...(req.body || {}) };
  delete body.password;
  delete body.password_hash;
  delete body.must_change_password;
  delete body.role;
  delete body.standby;
  delete body.inactive;
  delete body.email;
  if (body.timezone !== undefined) {
    const tz = String(body.timezone || '').trim();
    if (tz && tz !== 'device') {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
      } catch {
        return res.status(400).json({ error: 'Unknown time zone' });
      }
    }
    body.timezone = tz || 'Africa/Johannesburg';
  }
  const updated = updateUser(req.user.id, body);
  res.json(updated);
});

app.post('/api/auth/change-password', authMiddleware, (req, res) => {
  try {
    const updated = changePassword(req.userRow, {
      currentPassword: String(req.body?.current_password || ''),
      newPassword: String(req.body?.new_password || ''),
    });
    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/users/invite', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  const ALLOWED_ROLES = ['admin', 'user', 'standby', 'accounts', 'analytics', 'viewer'];
  let role = String(req.body?.role || 'user');
  if (!ALLOWED_ROLES.includes(role)) role = 'user';
  if (!email) return res.status(400).json({ error: 'Email required' });

  const existing = filterEntities('PendingUser', { email });
  if (!existing.length) {
    createEntity('PendingUser', {
      email,
      role,
      invited: true,
      full_name: req.body?.full_name || '',
    }, req.user);
  } else {
    updateEntity('PendingUser', existing[0].id, { invited: true, role });
  }

  res.json({ ok: true, email, role, message: 'Invite recorded. User can register with this email.' });
});

/**
 * Admin-only: generate new unique passwords. Plaintext is returned once in
 * this response and stored hashed — it cannot be retrieved later.
 *
 * Body:
 *   emails?: string[]     omit to reset every existing login
 *   includeSelf?: boolean also reset the signed-in admin (default false)
 *   allowCreate?: boolean create a login if the email has none (per-user)
 *   createFrom?: { [email]: { full_name, role, inactive } }
 */
app.post('/api/users/reset-password', authMiddleware, requireAdmin, (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Choose a user to reset' });
    }
    const includeSelf = email === String(req.user.email || '').trim().toLowerCase();
    const createFrom = {};
    if (req.body?.full_name || req.body?.role) {
      createFrom[email] = {
        full_name: req.body.full_name || '',
        role: req.body.role || 'user',
        inactive: !!req.body.inactive,
      };
    }
    const result = resetLoginPasswords({
      emails: [email],
      skipEmail: req.user.email,
      includeSkipEmail: includeSelf,
      allowCreate: !!req.body?.allowCreate,
      createFrom,
    });
    if (!result.issued.length) {
      const reason = result.skipped[0]?.reason;
      const message = reason === 'inactive'
        ? 'That account is marked not in use'
        : reason === 'self'
          ? 'Confirm includeSelf to reset your own password'
          : 'No login found for that user';
      return res.status(400).json({ error: message, skipped: result.skipped });
    }
    res.json({
      ok: true,
      issued: result.issued,
      user: result.issued[0],
      skipped: result.skipped,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/users/reset-passwords', authMiddleware, requireAdmin, (req, res) => {
  try {
    const rawEmails = req.body?.emails;
    const emails = Array.isArray(rawEmails)
      ? rawEmails.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean)
      : null;
    const includeSelf = !!req.body?.includeSelf;
    const allowCreate = !!req.body?.allowCreate;
    const createFrom = {};
    if (req.body?.createFrom && typeof req.body.createFrom === 'object') {
      for (const [key, value] of Object.entries(req.body.createFrom)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        createFrom[String(key).trim().toLowerCase()] = value && typeof value === 'object' ? value : {};
      }
    }

    const result = resetLoginPasswords({
      emails,
      skipEmail: req.user.email,
      includeSkipEmail: includeSelf,
      allowCreate,
      createFrom,
    });
    res.json({
      ok: true,
      issued: result.issued,
      skipped: result.skipped,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/app-logs', authMiddleware, (req, res) => {
  // Soft no-op analytics sink
  res.json({ ok: true, page: req.body?.pageName || null });
});

app.post('/api/upload', authMiddleware, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const tooLarge = err.code === 'LIMIT_FILE_SIZE';
      const message = tooLarge
        ? 'Image is too large (max 25MB)'
        : err.message || 'Upload failed';
      return res.status(err.status || (tooLarge ? 413 : 400)).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const file_url = `/api/uploads/${req.file.filename}`;
    res.json({ file_url });
  });
});

function isReadOnlyUser(user) {
  return user?.role === 'viewer';
}

function viewerMayWriteSetting(key, value) {
  return key === 'viewer_dashboard_page_size' && (String(value) === '4' || String(value) === '6');
}

function canReadAppFaults(user) {
  return user?.role === 'admin';
}

app.get('/api/entities/:type', authMiddleware, (req, res) => {
  try {
    const { type } = req.params;
    const { sort, limit } = req.query;
    if (type === 'AppFault' && !canReadAppFaults(req.user)) {
      return res.json([]);
    }
    res.json(listEntities(type, sort, limit));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/entities/:type/filter', authMiddleware, (req, res) => {
  try {
    const { type } = req.params;
    const filter = req.body?.filter || req.body || {};
    const sort = req.body?.sort || req.query.sort;
    const limit = req.body?.limit || req.query.limit;
    if (type === 'AppFault' && !canReadAppFaults(req.user)) {
      return res.json([]);
    }
    res.json(filterEntities(type, filter, sort, limit));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/entities/:type', authMiddleware, async (req, res) => {
  try {
    const type = req.params.type;
    const payload = { ...(req.body || {}) };
    if (isReadOnlyUser(req.user) && type !== 'UserPresence') {
      if (!(type === 'AppSettings' && viewerMayWriteSetting(payload.key, payload.value))) {
        return res.status(403).json({ error: 'Viewer accounts are read-only' });
      }
    }
    if (type === 'RigCheckAssignment') {
      const isAdmin = req.user?.role === 'admin';
      const isStandby = req.user?.role === 'standby';
      if (!isAdmin && !isStandby) {
        return res.status(403).json({ error: 'Admin or operator/standby only' });
      }
      if (!isAdmin) {
        payload.assignee_email = req.user?.email || payload.assignee_email;
      }
      const email = String(payload.assignee_email || '').trim().toLowerCase();
      const assignee = email ? findUserByEmail(email) : null;
      const assignError = validateRigCheckAssignment({
        shootId: payload.shoot_id,
        assignee,
      });
      if (assignError) {
        return res.status(400).json({ error: assignError });
      }
      if (!payload.due_date) {
        const shoot = payload.shoot_id ? getEntity('Shoot', payload.shoot_id) : null;
        payload.due_date = shoot?.date || payload.shoot_date || '';
      }
    }
    if (type === 'AppFault') {
      payload.reported_by_email = req.user?.email || payload.reported_by_email || '';
      payload.reported_by_name = req.user?.full_name || payload.reported_by_name || payload.reported_by_email;
      payload.reported_by_role = req.user?.role || payload.reported_by_role || '';
      payload.status = payload.status || 'open';
      payload.created_at = payload.created_at || nowIso();
    }
    if (type === 'Shoot') {
      const remoteError = restrictedRemoteAssignError(payload, [
        ...(payload.assigned_operators || []),
        ...(payload.pending_operators || []),
      ]);
      if (remoteError) return res.status(403).json({ error: remoteError });
    }
    const created = createEntity(type, payload, req.user);
    if (type === 'RigCheckAssignment') {
      const shoot = created.shoot_id ? getEntity('Shoot', created.shoot_id) : null;
      const due = created.due_date || created.shoot_date || shoot?.date || '';
      createNotifications({
        notificationKey: `rig_check:${created.id}`,
        type: 'rig_check',
        title: 'Rig test assigned',
        message: `${created.team || 'Rig'} · ${created.shoot_title || shoot?.title || 'shoot'}${due ? ` · due ${due}` : ''}`,
        shoot,
        targetEmails: [created.assignee_email],
        url: '/',
        createdByName: req.user?.full_name || req.user?.email || '',
      }).catch((err) => {
        console.warn('Rig check notification failed:', err.message);
      });
    }
    if (type === 'AppFault') {
      notifyAppFault(created, req.user).catch((err) => {
        console.warn('App fault notification failed:', err.message);
      });
    }
    if (type === 'OperatorAvailability') {
      handleAvailabilityChange(null, created, req.user, 'create').catch((err) => {
        console.warn('Availability notification failed:', err.message);
      });
    }
    if (type === 'StandbyDay') {
      handleStandbyChange(null, created, req.user, 'create').catch((err) => {
        console.warn('Standby notification failed:', err.message);
      });
    }
    if (type === 'Shoot') {
      try { syncRigChecksForShoot(null, created, req.user); } catch (err) {
        console.warn('Rig check assign failed:', err.message);
      }
    }
    res.status(201).json(created);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.patch('/api/entities/:type/:id', authMiddleware, async (req, res) => {
  try {
    const { type, id } = req.params;
    const previous = getEntity(type, id);
    const patch = { ...(req.body || {}) };
    if (isReadOnlyUser(req.user) && type !== 'UserPresence') {
      const settingKey = patch.key || previous?.key;
      const settingValue = patch.value != null ? patch.value : previous?.value;
      if (!(type === 'AppSettings' && viewerMayWriteSetting(settingKey, settingValue) && (!patch.key || patch.key === 'viewer_dashboard_page_size'))) {
        return res.status(403).json({ error: 'Viewer accounts are read-only' });
      }
    }
    if (type === 'User') {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin only' });
      }
      delete patch.password;
      delete patch.password_hash;
      delete patch.must_change_password;
    }
    if (type === 'AppFault' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    if (type === 'RigCheckAssignment') {
      if (!previous) return res.status(404).json({ error: 'Not found' });
      const isAdmin = req.user?.role === 'admin';
      const assignee = String(previous?.assignee_email || '').trim().toLowerCase();
      const me = String(req.user?.email || '').trim().toLowerCase();
      if (!isAdmin && assignee !== me) {
        return res.status(403).json({ error: 'Only the assigned person can update this rig check' });
      }
      if (!isAdmin) {
        const allowed = {
          items: patch.items,
          notes: patch.notes,
          status: patch.status,
          completed_at: patch.completed_at,
        };
        Object.keys(patch).forEach((key) => {
          if (!(key in allowed)) delete patch[key];
        });
      }
    }
    if (type === 'Shoot' && previous && isAssignmentLocked({ ...previous, ...patch })) {
      delete patch.assigned_operators;
      delete patch.pending_operators;
      delete patch.pre_approved_operators;
      delete patch.auto_assigned_for;
    }
    if (type === 'Shoot' && previous) {
      const merged = { ...previous, ...patch };
      const already = new Set([
        ...(previous.assigned_operators || []),
        ...(previous.pending_operators || []),
      ].map((email) => String(email || '').toLowerCase()));
      const added = [
        ...(patch.assigned_operators || []),
        ...(patch.pending_operators || []),
      ].filter((email) => email && !already.has(String(email).toLowerCase()));
      const remoteError = restrictedRemoteAssignError(merged, added);
      if (remoteError) return res.status(403).json({ error: remoteError });
    }
    const updated = updateEntity(type, id, patch);
    if (!updated) return res.status(404).json({ error: 'Not found' });

    if (type === 'Shoot' && previous) {
      handleShootChange(previous, updated, req.user).catch((err) => {
        console.warn('Shoot notification failed:', err.message);
      });
      try { syncRigChecksForShoot(previous, updated, req.user); } catch (err) {
        console.warn('Rig check assign failed:', err.message);
      }
    }
    if (type === 'OperatorAvailability' && previous) {
      handleAvailabilityChange(previous, updated, req.user, 'update').catch((err) => {
        console.warn('Availability notification failed:', err.message);
      });
    }
    if (type === 'StandbyDay' && previous) {
      handleStandbyChange(previous, updated, req.user, 'update').catch((err) => {
        console.warn('Standby notification failed:', err.message);
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.delete('/api/entities/:type/:id', authMiddleware, async (req, res) => {
  try {
    const { type, id } = req.params;
    if (isReadOnlyUser(req.user)) {
      return res.status(403).json({ error: 'Viewer accounts are read-only' });
    }
    if ((type === 'AppFault' || type === 'RigCheckAssignment') && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const previous = getEntity(type, id);
    const ok = deleteEntity(type, id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    if (type === 'OperatorAvailability' && previous) {
      handleAvailabilityChange(previous, null, req.user, 'delete').catch((err) => {
        console.warn('Availability notification failed:', err.message);
      });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/push/vapid-public-key', authMiddleware, (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

app.post('/api/push/subscribe', authMiddleware, (req, res) => {
  try {
    const subscription = req.body?.subscription || req.body;
    const saved = savePushSubscription(req.user, subscription);
    res.status(201).json({ ok: true, id: saved.id });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/push/unsubscribe', authMiddleware, (req, res) => {
  try {
    const endpoint = req.body?.endpoint || req.body?.subscription?.endpoint;
    const result = removePushSubscription(endpoint, req.user.email);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/push/test', authMiddleware, async (req, res) => {
  try {
    const logo = String(settingValue('app_logo_url') || '').trim() || '/icon-192.png';
    const result = await sendPushToEmails([req.user.email], {
      title: 'Remote Ops',
      body: 'Test alert — popups still work when this app is closed.',
      url: '/Notifications',
      type: 'test',
      icon: logo,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

function requireAdminOrAnalytics(req, res, next) {
  if (req.user?.role !== 'admin' && req.user?.role !== 'analytics') {
    return res.status(403).json({ error: 'Admin or Data Analytics only' });
  }
  next();
}

function frontendBaseUrl(req) {
  const fromEnv = process.env.FRONTEND_URL || process.env.APP_URL || '';
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  // Same-origin production (Express serves Vite dist): return to this host
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  if (host && process.env.NODE_ENV === 'production') {
    return `${proto}://${host}`.replace(/\/$/, '');
  }
  const origin = req.get('origin') || req.get('referer') || '';
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      // ignore
    }
  }
  return 'http://localhost:5173';
}

/**
 * Import Base44 entity exports from the browser. Send the same request with
 * confirm=true to write; without it the response is a preview only.
 */
app.post('/api/import/entities', authMiddleware, requireAdmin, importUpload.array('files'), (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const confirm = String(req.body?.confirm || '') === 'true';
    const explicitType = String(req.body?.entityType || '').trim();

    const targets = [];
    for (const file of files) {
      const entityType = explicitType || inferEntityType(file.originalname);
      if (!entityType) {
        return res.status(400).json({
          error: `Could not tell which entity "${file.originalname}" holds. Rename it to start with the entity name, e.g. Shoot_export.csv`,
        });
      }
      targets.push({ file, entityType });
    }

    // Shoots first so shoot_id references in the other files resolve
    targets.sort((a, b) => (a.entityType === 'Shoot' ? -1 : b.entityType === 'Shoot' ? 1 : 0));

    const results = [];
    for (const { file, entityType } of targets) {
      const text = file.buffer.toString('utf8');
      const rows = parseFileContents(file.originalname, text);
      const result = importEntityRows({ entityType, rows, confirm, user: req.user });
      results.push({ fileName: file.originalname, ...result });
    }

    res.json({
      ok: true,
      confirmed: confirm,
      results,
      references: countBrokenShootReferences(),
    });
  } catch (err) {
    console.error('Entity import failed:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/google/status', authMiddleware, (req, res) => {
  const suggestedRedirectUri = `${frontendBaseUrl(req)}/api/google/callback`;
  res.json({ ...getGoogleStatus(), suggestedRedirectUri });
});

app.patch('/api/google/oauth', authMiddleware, requireAdmin, (req, res) => {
  const clientId = String(req.body?.clientId || '').trim();
  const clientSecret = String(req.body?.clientSecret || '').trim();
  const redirectUri = String(req.body?.redirectUri || '').trim();
  if (!clientId) {
    return res.status(400).json({ error: 'Client ID is required' });
  }
  if (!getGoogleStatus().hasSecret && !clientSecret) {
    return res.status(400).json({ error: 'Client secret is required the first time' });
  }
  if (!redirectUri || !/^https?:\/\/\S+\/api\/google\/callback$/.test(redirectUri)) {
    return res.status(400).json({ error: 'Redirect URI must end with /api/google/callback' });
  }
  saveOAuthClient({ clientId, clientSecret, redirectUri });
  const suggestedRedirectUri = `${frontendBaseUrl(req)}/api/google/callback`;
  res.json({ ok: true, ...getGoogleStatus(), suggestedRedirectUri });
});

app.get('/api/google/auth-url', authMiddleware, requireAdmin, (_req, res) => {
  try {
    res.json({ url: getAuthUrl('rom-google') });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/google/callback', async (req, res) => {
  const base = frontendBaseUrl(req);
  const settingsPath = `${base}/Settings`;
  try {
    if (req.query.error) {
      return res.redirect(`${settingsPath}?google=error&message=${encodeURIComponent(String(req.query.error))}`);
    }
    const code = req.query.code;
    if (!code) {
      return res.redirect(`${settingsPath}?google=error&message=${encodeURIComponent('Missing OAuth code')}`);
    }
    await handleOAuthCallback(String(code));
    return res.redirect(`${settingsPath}?google=connected`);
  } catch (err) {
    console.error('Google OAuth callback failed:', err);
    return res.redirect(`${settingsPath}?google=error&message=${encodeURIComponent(err.message || 'OAuth failed')}`);
  }
});

app.post('/api/google/disconnect', authMiddleware, requireAdmin, (_req, res) => {
  clearTokens();
  res.json({ ok: true, ...getGoogleStatus() });
});

app.get('/api/google/calendars', authMiddleware, requireAdmin, async (_req, res) => {
  try {
    const calendars = await listGoogleCalendars();
    res.json({ calendars, ...getGoogleSettings() });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.patch('/api/google/settings', authMiddleware, requireAdmin, (req, res) => {
  const dataCalendarId = String(req.body?.dataCalendarId || req.body?.calendarId || '').trim();
  const fancamCalendarId = String(req.body?.fancamCalendarId || '').trim();
  if (!dataCalendarId && !fancamCalendarId) {
    return res.status(400).json({ error: 'Choose at least one Google calendar' });
  }
  const settings = saveGoogleSettings({
    dataCalendarId,
    fancamCalendarId,
    calendarId: dataCalendarId || fancamCalendarId,
  });
  res.json({ ok: true, ...getGoogleStatus(), settings });
});

app.post('/api/google/sync', authMiddleware, requireAdminOrAnalytics, async (req, res) => {
  try {
    const result = await syncGoogleCalendar({ user: req.user });
    res.json(result);
  } catch (err) {
    console.error('Google Calendar sync failed:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/google/restore-deleted', authMiddleware, requireAdmin, (_req, res) => {
  try {
    const result = restoreSyncDeletedShoots({ force: true });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Sync delete restore failed:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/slack/status', authMiddleware, requireAdminOrAnalytics, (_req, res) => {
  res.json(getSlackGamesSettings());
});

app.patch('/api/slack/settings', authMiddleware, requireAdminOrAnalytics, (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const enabled = req.body?.enabled;
  const settings = saveSlackGamesSettings({
    botToken: isAdmin ? req.body?.botToken : undefined,
    channelId: isAdmin ? req.body?.channelId : undefined,
    enabled: typeof enabled === 'boolean' ? enabled : undefined,
  });
  res.json({ ok: true, ...settings });
});

app.post('/api/slack/preview', authMiddleware, requireAdminOrAnalytics, async (req, res) => {
  try {
    const pasted = String(req.body?.text || '').trim();
    if (!pasted && !getSlackGamesSettings().enabled) {
      return res.status(400).json({ error: 'Slack calendar sync is turned off. Enable it on Calendar or in Settings first.' });
    }
    const text = pasted || await fetchLatestSlackGamesMessage();
    const result = applySlackGames({
      text,
      fallbackDate: todaySastYmd(),
      user: req.user,
      confirm: false,
    });
    res.json({ ok: true, text, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/slack/rig-check', authMiddleware, (req, res) => {
  res.json(getRigCheckSlackSettings());
});

app.patch('/api/slack/rig-check', authMiddleware, requireAdmin, (req, res) => {
  const settings = saveRigCheckSlackSettings({
    channelId: req.body?.channelId,
    teamId: req.body?.teamId,
    openUrl: req.body?.openUrl,
    delivery: req.body?.delivery,
  });
  res.json({ ok: true, ...settings });
});

app.post('/api/slack/rig-check', authMiddleware, async (req, res) => {
  try {
    if (!canSendRigCheckMessage(req.user)) {
      return res.status(403).json({ error: 'You cannot send rig-check messages' });
    }
    const text = String(req.body?.text || '').trim();
    const result = await postRigCheckToSlack(text);
    res.json({ ok: true, ts: result.ts || null, channel: result.channel || null });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Slack post failed' });
  }
});

app.post('/api/slack/sync', authMiddleware, requireAdminOrAnalytics, async (req, res) => {
  try {
    const pasted = String(req.body?.text || '').trim();
    if (!pasted && !getSlackGamesSettings().enabled) {
      return res.status(400).json({ error: 'Slack calendar sync is turned off. Enable it on Calendar or in Settings first.' });
    }
    const text = pasted || await fetchLatestSlackGamesMessage();
    const result = applySlackGames({
      text,
      fallbackDate: todaySastYmd(),
      user: req.user,
      confirm: true,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Slack games sync failed:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/entities/:type/subscribe', authMiddleware, (req, res) => {
  const { type } = req.params;
  if (type !== 'User' && !ENTITY_TYPES.includes(type)) {
    return res.status(404).json({ error: 'Unknown entity type' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const unsubscribe = subscribeEntity(type, (event) => {
    res.write(`event: change\ndata: ${JSON.stringify(event)}\n\n`);
  });

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});


// Serve built frontend in production
const distDir = path.resolve(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  app.use((req, res, next) => {
    if (req.path === '/sw.js') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Service-Worker-Allowed', '/');
    }
    next();
  });
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/uploads') || req.path.startsWith('/uploads')) return next();
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Remote Ops API listening on http://localhost:${PORT}`);
  console.log(`Entity types: User, ${ENTITY_TYPES.join(', ')}`);

  try {
    const restored = restoreSyncDeletedShoots();
    if (!restored.skipped) {
      console.log(
        `Sync delete restore: ${restored.recreated} recreated, ${restored.reassigned} reassigned, ${restored.hints} hints`
      );
    }
  } catch (err) {
    console.warn('Sync delete restore failed:', err.message);
  }

  // Day-of reminders plus Google auto-sync (06:00 / 13:00 / 20:00 SAST)
  const runBackgroundJobs = () => {
    runReminderPass().catch((err) => console.warn('Reminder pass failed:', err.message));
    maybeRunScheduledGoogleSync().catch((err) => {
      console.warn('Scheduled Google sync failed:', err.message);
    });
  };
  setTimeout(runBackgroundJobs, 8_000);
  setInterval(runBackgroundJobs, 15_000);
});
