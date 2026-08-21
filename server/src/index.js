import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from './db.js';
import { seedIfEmpty } from './seed.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import opsRoutes from './routes/ops.js';
import adminRoutes from './routes/admin.js';
import resourceRoutes from './routes/resources.js';

migrate();
seedIfEmpty();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

const webDist =
  process.env.ROM_WEB_DIST ||
  path.resolve(__dirname, '../../web/dist');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '4mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, product: 'remote-ops-manager', shortName: 'ROM', version: '1.2.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', opsRoutes);
app.use('/api', adminRoutes);
app.use('/api', resourceRoutes);

if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
  console.log(`Serving web UI from ${webDist}`);
} else {
  console.log(`No web build at ${webDist} — API only. Run: npm run build`);
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`ROM listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log('Bound on 0.0.0.0 — reachable via port forward / tunnel / LAN');
});
