# Remote Ops Manager

Standalone web app for remote sports-camera / broadcast shoot crews — schedule shoots, assign operators, track phases, manage rigs, standby, timesheets, and accounts.

**No Base44 dependency.** React + Vite frontend, Express + SQLite API.

## Look & feel

Light, minimal ops console: soft warm canvas, white surfaces, teal accent, Figtree type. Same workflows as the original Base44 app, without the hosted Base44 runtime.

## Quick start

```bash
npm install
npm run dev
```

- Web UI: http://localhost:5173  
- API: http://localhost:3001  

### Demo accounts (seeded on first run)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@example.com` | `admin123` |
| Operator | `operator@example.com` | `operator123` |

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query |
| Backend | Express (Node.js) |
| Database | SQLite (`better-sqlite3`) |
| Auth | Email / password + JWT |
| Files | Local `uploads/` |
| Realtime | Server-Sent Events (SSE) |

## Environment (optional)

```bash
PORT=3001
JWT_SECRET=change-me-in-production
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
ADMIN_NAME=Admin User
DATABASE_PATH=./server/data/remote-ops.db
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | API + Vite together |
| `npm run dev:api` | API only |
| `npm run dev:web` | Frontend only (proxies `/api` → `:3001`) |
| `npm run build` | Production frontend build |
| `npm start` | Serve API (and built UI in production) |
| `npm run lint` | ESLint |

## Migrating from Base44

1. Export entity data from your Base44 app.
2. Insert via REST (`POST /api/entities/:Type`) or a one-off import.
3. Re-upload files that lived on the Base44 CDN.
4. Invite users in Settings; they register at `/register` with the invited email.
