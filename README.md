# Remote Ops Manager (ROM)

Web app for managing remote photographers: schedule shoots, self-assign on the calendar, configure rig settings, track standby coverage, and review earnings.

## Roles

| Role | Login label | Access |
|------|-------------|--------|
| **Admin** | Admin | Create users, calendar (create/import/assign), rig settings, standby schedule, ops dashboard |
| **Remote** | Remote (`operator` in API) | Calendar self-assign / unassign, own dashboard + monthly earnings |
| **Account** | Account | Earnings dashboard only — per-user monthly pay + spend graph |

All admins share the same responsibilities.

## Features

- **User creation** — admins invite Admin / Remote / Account users
- **Calendar** — create shoots or import via **CSV**, **ICS**, or **Google Calendar ICS URL**; remotes assign/unassign; taken shoots block self-assign
- **Rig settings** — house recipes keyed by team name; auto-linked onto matching calendar shoots for remotes to view
- **Standby** — admins schedule standby windows; dashboards show who is on / next on standby plus the user’s next shoot
- **Dashboards**
  - Admin: assigned shoots + shoots under their standby window
  - Remote: assigned shoots + month earnings
  - Account: remote earnings by month + overall spend graph

## Stack

- Web: React 18 + Vite + Tailwind
- API: Express + SQLite (`node:sqlite`)
- Auth: JWT email/password

## Run

```bash
npm install
npm run seed
npm run test
npm run dev
```

- Web: http://localhost:5173  
- API: http://localhost:4000  

### Single-port (remote / cloud)

```bash
npm run start:test
```

Then open http://localhost:4000 (or your forwarded port).

### Demo credentials

Password for all: `rom123`

| Role | Email |
|------|-------|
| Admin | `admin@rom.demo` |
| Remote | `operator@rom.demo` |
| Account | `accounts@rom.demo` |

## Google Calendar import

In Google Calendar → Settings → Integrate calendar, copy the **Secret address in iCal format** and paste it under Calendar → Google Calendar in the app.
