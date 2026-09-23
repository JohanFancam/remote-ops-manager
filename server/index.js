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
import { publicUser, ENTITY_TYPES } from './db.js';
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
import {
  getVapidPublicKey,
  savePushSubscription,
  removePushSubscription,
} from './push.js';
import {
  handleShootChange,
  handleAvailabilityChange,
  handleStandbyChange,
  runReminderPass,
} from './notifications.js';
import {
  importEntityRows,
  inferEntityType,
  parseFileContents,
  countBrokenShootReferences,
} from './entityImport.js';
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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

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
  const row = settings.find((item) => item.key === key);
  return String(row?.value || '').trim();
}

function buildWebManifest() {
  const customLogo = settingValue('app_logo_url');
  const icon = customLogo || '/rom-logo.png';
  return {
    name: 'Remote Ops Manager',
    short_name: 'Remote Ops',
    description: 'Portal for remote operators, standby, and scheduling',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#050816',
    theme_color: '#050816',
    icons: [
      { src: icon, sizes: 'any', type: 'image/png', purpose: 'any' },
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
  const user = publicUser(row);
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

  const user = createUser({
    email,
    password,
    full_name: name,
    role,
    standby: role === 'standby',
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
  const ALLOWED_ROLES = ['admin', 'user', 'standby', 'accounts'];
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

app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const file_url = `/uploads/${req.file.filename}`;
  res.json({ file_url });
});

app.get('/api/entities/:type', authMiddleware, (req, res) => {
  try {
    const { type } = req.params;
    const { sort, limit } = req.query;
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
    res.json(filterEntities(type, filter, sort, limit));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/entities/:type', authMiddleware, async (req, res) => {
  try {
    const type = req.params.type;
    const created = createEntity(type, req.body || {}, req.user);
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
    if (type === 'User') {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin only' });
      }
      delete patch.password;
      delete patch.password_hash;
      delete patch.must_change_password;
    }
    const updated = updateEntity(type, id, patch);
    if (!updated) return res.status(404).json({ error: 'Not found' });

    if (type === 'Shoot' && previous) {
      handleShootChange(previous, updated, req.user).catch((err) => {
        console.warn('Shoot notification failed:', err.message);
      });
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

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
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

app.post('/api/google/sync', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const result = await syncGoogleCalendar({ user: req.user });
    res.json(result);
  } catch (err) {
    console.error('Google Calendar sync failed:', err);
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
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    if (req.path.startsWith('/uploads')) return next();
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
