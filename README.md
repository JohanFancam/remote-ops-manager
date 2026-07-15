# Remote Ops Manager (ROM)

Independent rebuild of the sports remote-ops console — dark UI, role-based access, server-enforced assignment and payment rules.

## Roles (this phase)

| Role | Home | Access |
|------|------|--------|
| `admin` | `/dashboard` | Ops dashboard, calendar, users, settings, view accounts |
| `operator` | `/dashboard` | Own dashboard, calendar/self-assign, own earnings |
| `accounts` | `/accounts` | Accounts dashboard only |

`standby` is reserved in the permission system for a later phase. Legacy Base44 role `user` maps to `operator`.

## Stack

- **Web:** React 18 + Vite + Tailwind (dark, blue primary, mobile bottom nav, desktop sidebar)
- **API:** Express + SQLite (`node:sqlite`)
- **Auth:** JWT; every mutating route checks role/permissions

## Run

```bash
npm install
npm run seed
npm run test
npm run dev
```

- Web http://localhost:5173
- API http://localhost:4000

### Demo credentials

Password: `rom123`

- `admin@rom.demo`
- `operator@rom.demo`
- `accounts@rom.demo`

## Business rules (server)

Centralised in `server/src/services/assignments.js` and `server/src/services/pay.js`:

- Pre-approved limit (default 6, configurable)
- Auto-pair priority teams (Reds / Red Sox / Rangers) with explicit `assignment_group_id`
- Admin manual assign does **not** auto-pair
- Paired withdraw / approve / reject in one transaction
- Accounts-only pay settle; admin can view but not mark paid
- Finalised payments keep snapshot amounts after rate changes

## Tests

```bash
npm run test
```

Covers limit, pairing directions, Charlotte/Mariners priority, partner occupied/pending, withdraw pair, admin no-pair, approve/reject pair, unavailable, pay settle permissions, CSV escape.
