# Remote Ops Manager (ROM)

Shift console for remote sports-camera crews. Organized by **time** and **role** — not a dense CRUD dashboard.

Dark mode · mobile-first for operators · desktop-capable for Board / Pay.

## Stack

- **Web:** React 18 + Vite + Tailwind (Syne + IBM Plex Sans)
- **API:** Express command API + SQLite (`node:sqlite`)
- **Auth:** JWT email/password; roles enforced on mutating routes

## Surfaces

| Route | Who | Purpose |
|-------|-----|---------|
| **Today** | Operator → My Cue · Standby → Coverage · Admin → Gaps | Next action only |
| **Board** | All | Week strip + claim/assign sheet |
| **Pay** | Operators + accounts/admin | One earnings/settle surface |

## Roles

`admin` · `standby` · `accounts` · `user` (remote operator)

## Run

```bash
npm install
npm run seed    # (re)seed demo data — also runs automatically on first API boot
npm run dev     # API :4000 + web :5173
```

Open http://localhost:5173

### Demo credentials

Password for all accounts: `rom123`

| Email | Role |
|-------|------|
| `operator@rom.demo` | Remote operator (My Cue) |
| `admin@rom.demo` | Admin (Gaps) |
| `standby@rom.demo` | Standby (Coverage) |
| `accounts@rom.demo` | Accounts (Pay settle) |

## Working flow

1. Sign in as **operator@rom.demo**
2. **Today** shows your next shoot — countdown + advance phase CTA
3. Open **Board** → claim another open shoot (6-cap + auto-pair enforced server-side)
4. Advance phases from Today; copy Slack/WhatsApp message
5. Sign in as **accounts@rom.demo** → **Pay** → mark paid

## Command API (selected)

```
POST /api/auth/login
GET  /api/me/today
GET  /api/me/today/stream   # SSE for today's shift
GET  /api/board
POST /api/shoots/:id/claim
POST /api/shoots/:id/unclaim
POST /api/shoots/:id/phases/:phase
POST /api/assignments/approve
POST /api/assignments/reject
GET  /api/pay
POST /api/pay/mark-paid
```

Business rules (6-slot pre-approval, auto-pair/linked teams, phase order, fees, role gates) live on the server and fail closed if called directly.

## Layout

```
server/   Express + SQLite
web/      Vite React client
```
