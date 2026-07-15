import express from 'express';
import cors from 'cors';
import { migrate } from './db.js';
import { seedIfEmpty } from './seed.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import opsRoutes from './routes/ops.js';
import adminRoutes from './routes/admin.js';

migrate();
seedIfEmpty();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, product: 'remote-ops-manager', shortName: 'ROM', version: '1.1.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', opsRoutes);
app.use('/api', adminRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ROM API listening on http://localhost:${PORT}`);
});
