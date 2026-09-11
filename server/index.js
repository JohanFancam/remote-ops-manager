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
} from './auth.js';
import {
  listEntities,
  filterEntities,
  createEntity,
  updateEntity,
  deleteEntity,
} from './entities.js';
import { subscribeEntity } from './events.js';
import { seedIfEmpty } from './seed.js';
import { publicUser, ENTITY_TYPES } from './db.js';

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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'remote-ops-api' });
});

app.get('/api/public-settings', (_req, res) => {
  res.json({
    id: 'remote-ops-manager',
    public_settings: {
      app_name: 'Remote Ops Manager',
      auth_required: true,
    },
  });
});

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

  const user = createUser({ email, password, full_name: name, role });
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
  const updated = updateUser(req.user.id, req.body || {});
  res.json(updated);
});

app.post('/api/auth/logout', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/users/invite', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  let role = String(req.body?.role || 'user');
  // Base44 inviteUser only accepted admin|user — keep that constraint for compatibility
  if (role !== 'admin' && role !== 'user') role = 'user';
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

app.post('/api/entities/:type', authMiddleware, (req, res) => {
  try {
    const created = createEntity(req.params.type, req.body || {}, req.user);
    res.status(201).json(created);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.patch('/api/entities/:type/:id', authMiddleware, (req, res) => {
  try {
    const updated = updateEntity(req.params.type, req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.delete('/api/entities/:type/:id', authMiddleware, (req, res) => {
  try {
    const ok = deleteEntity(req.params.type, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
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
});
