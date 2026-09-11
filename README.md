# Remote Ops Manager

Standalone web app for remote sports-camera / broadcast shoot crews — schedule shoots, assign operators, track phases, manage rigs, standby, timesheets, and accounts.

**No Base44 dependency.** React + Vite frontend, Express + SQLite API. Dark blue “Signal desk” UI — Bricolage + Public Sans, floating rail shell.

## Quick start

```bash
npm install
npm run seed:demo   # optional: reset SQLite with rich demo ops data
npm run dev
```

- Web UI: http://localhost:5173  
- API: http://localhost:3001  

## Go live (public URL)

Non-technical step-by-step: see **[DEPLOY.md](./DEPLOY.md)**.

Short version: create a Railway account with GitHub → deploy this repo → add `/data` volume → set `JWT_SECRET` → open the public URL → `/register`.

## Demo data

First boot (or `npm run seed:demo`) seeds a full ops dataset modeled on a typical Base44 Remote Ops Manager workspace — crews, venue rig profiles, calendar shoots, standby windows, payments, and rig tests — so dashboards are reviewable without importing live data.

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@example.com` | `admin123` |
| Operator | `operator@example.com` | `operator123` |
| Operator | `jordan.lee@example.com` | `operator123` |
| Standby | `priya.nair@example.com` | `standby123` |
| Accounts | `accounts@example.com` | `accounts123` |

To bring over **live** Base44 data: export entities from Base44, then `POST /api/entities/:Type`.

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
| `npm run seed:demo` | Wipe SQLite and reseed demo users + entities |
| `npm run lint` | ESLint |
