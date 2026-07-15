import express from 'express';
import cors from 'cors';
import { migrate } from './db.js';
import { seedIfEmpty } from './seed.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import commandRoutes from './routes/commands.js';
import payRoutes from './routes/pay.js';

migrate();
seedIfEmpty();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, product: 'remote-ops-manager', shortName: 'ROM', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api', commandRoutes);
app.use('/api/pay', payRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ROM API listening on http://localhost:${PORT}`);
});
