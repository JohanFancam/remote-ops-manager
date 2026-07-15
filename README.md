# Remote Ops Manager

Operations app for remote sports-camera / broadcast shoot crews. Schedule shoots, assign operators, track shoot phases, manage rig settings, standby coverage, timesheets, and accounts.

This project was rebuilt as a **standalone React + Express app** with **no Base44 dependency**.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query |
| Backend | Express (Node.js) |
| Database | SQLite (`better-sqlite3`) |
| Auth | Email/password + JWT |
| Files | Local `uploads/` directory |
| Realtime | Server-Sent Events (SSE) |

## Quick start

```bash
npm install
npm run dev
```

- Web UI: http://localhost:5173  
- API: http://localhost:3001  

### Demo accounts (seeded automatically)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@example.com` | `admin123` |
| Operator | `operator@example.com` | `operator123` |

## Environment (optional)

Create `.env` / export vars before starting the API:

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
| `npm run lint` | ESLint |

## Data model

Entity schemas (JSON Schema style) live under `server/schemas/` for reference. Runtime storage is document-style JSON rows in SQLite (`entities` table) plus a dedicated `users` table for auth.

## Migrating from Base44

1. Export entity data from your Base44 app.
2. Insert records via the REST API (`POST /api/entities/:Type`) or a one-off import script.
3. Re-upload files that previously lived on the Base44 CDN (logos, reference images).
4. Invite users in Settings, then have them register at `/register` with the invited email.
