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

## Shipping updates (Lightsail / VPS)

After this update is on the live server once, admins deploy later updates from
**Settings → Deploy** (pick a `main` or `cursor/…` branch and click the button).

`deploy.sh` pulls the branch, installs dependencies, rebuilds the frontend
(with a memory cap so 1 GB hosts don't get OOM-killed), restarts PM2, and hits `/api/health`.

First-time / emergency SSH:

```bash
cd /home/ubuntu/remote-ops-manager
./deploy.sh cursor/one-click-deploy-a34f
```

### Automatic deploy on push

`.github/workflows/deploy.yml` SSHes into the server and runs the same script whenever
a deploy branch is pushed (also runnable from the Actions tab). Until the secrets below
exist the workflow skips with a notice instead of failing. Add them under
**Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `DEPLOY_HOST` | server IP or domain |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_SSH_KEY` | private key whose public half is in the server's `~/.ssh/authorized_keys` |
| `DEPLOY_PATH` | optional, defaults to `/home/ubuntu/remote-ops-manager` |

Generate a dedicated key for this rather than reusing a personal one:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/gh_deploy -N ""
cat ~/.ssh/gh_deploy.pub >> ~/.ssh/authorized_keys   # on the server
cat ~/.ssh/gh_deploy                                 # paste into DEPLOY_SSH_KEY
```

The server still needs its own read access to GitHub for `git pull` — a read-only
deploy key on the repo is the least privileged option.

## Demo data

First boot (or `npm run seed:demo`) seeds a full ops dataset modeled on a typical Base44 Remote Ops Manager workspace — crews, venue rig profiles, calendar shoots, standby windows, payments, and rig tests — so dashboards are reviewable without importing live data.

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@example.com` | `admin123` |
| Operator | `operator@example.com` | `operator123` |
| Operator | `jordan.lee@example.com` | `operator123` |
| Standby | `priya.nair@example.com` | `standby123` |
| Accounts | `accounts@example.com` | `accounts123` |

### Importing Base44 entity exports

Admins can do this in the browser: **Settings → Import Data**, pick the exported CSV
or JSON files, **Preview**, then **Import**. No SSH or file copying needed.

The same thing from a shell:

```bash
node scripts/import-entities.mjs auto exports/*.csv             # dry run
node scripts/import-entities.mjs auto exports/*.csv --confirm
node scripts/import-entities.mjs Shoot Shoot_export.csv --confirm   # explicit type
```

`auto` reads the entity type from the filename (`Shoot_export_1234.csv` → `Shoot`).
The script coerces values using each entity's schema — CSV delivers everything as
text, so `"false"` would otherwise be stored as a truthy string and a fee of `"500"`
as text. Original ids are preserved so cross-references such as `PaymentRecord.shoot_id`
still resolve, and re-running updates rows by id instead of duplicating them.

**Import `Shoot` first.** Payment records, shoot reports, and time entries all
reference `shoot_id`; without the shoots those rows have nothing to attach to.

### Removing demo data on a live install

```bash
node scripts/clear-demo-data.mjs            # dry run — lists what goes
node scripts/clear-demo-data.mjs --confirm  # delete
pm2 restart remote-ops --update-env
```

Deletes sample shoots, rig profiles, and `@example.com` crew, keeps real users and
rate settings, and writes a marker so the server never re-seeds demo data. It refuses
to run if no admin account would be left. Use `KEEP_EMAILS=a@b.com,c@d.com` to protect
extra accounts.

### Importing the real crew

```bash
node scripts/import-users.mjs users.csv                              # dry run
node scripts/import-users.mjs users.csv --confirm --generate-passwords
```

CSV needs a header row with `email` plus optionally `full_name` (or `first_name` /
`last_name`) and `role` (`admin`, `standby`, `accounts`, `user`). JSON arrays work too.
Each person gets a Manage Users entry and a login.

| Password option | Result |
|-----------------|--------|
| `--generate-passwords` | unique random password per new account, printed once |
| `DEFAULT_PASSWORD=...` | same starting password for every new account |
| neither | no logins; people self-register at `/register` with those emails |
| `--reset-passwords` | also re-issue passwords for accounts that already exist |

Re-running is safe: existing accounts are updated and their passwords left alone
unless `--reset-passwords` is passed. Generated passwords are shown only in that
run's output — they are stored hashed, so capture them before closing the terminal.

To re-issue passwords later without a CSV, admins can use **Settings → Manage Users
→ Regenerate passwords** (copy or download the list immediately). From a shell:

```bash
node scripts/reset-passwords.mjs                         # dry run
node scripts/reset-passwords.mjs --confirm               # every active login
node scripts/reset-passwords.mjs --confirm --keep johan@fancam.com
```

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

`server/env.js` reads a `.env` file in the project root at startup, so `npm start`,
`node server/index.js`, and PM2 all pick these up. Real environment variables take
precedence over the file.

> Changing `DATABASE_PATH` points the app at a different database. If you already have
> live data, move the existing `remote-ops.db` (plus its `-wal`/`-shm` files, and any
> `vapid-keys.json` / `google-oauth.json` beside it) to the new location first, or the
> app will start against an empty database.

```bash
PORT=3001
JWT_SECRET=change-me-in-production
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
ADMIN_NAME=Admin User
DATABASE_PATH=./server/data/remote-ops.db

# Google Calendar sync (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback
FRONTEND_URL=http://localhost:5173

# Web Push (optional — auto-generated to server/data/vapid.json if omitted)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
```

## Notifications (PWA + Web Push)

Operators and admins can **install the web app** on phones/laptops and enable push alerts.

| Event | Who gets notified |
|-------|-------------------|
| Shoot date/time changed | Assigned + pending operators |
| Shoot cancelled | Assigned + pending operators |
| Pending assignment approved | That operator |
| Operator assigned / moved / removed | That operator |
| Operator self-assigns / unassigns / requests | Admins + standby |
| Operator marks themselves out | Admins + standby |
| Shoot today / starting soon | Assigned operators |
| Morning digest of who is out | Admins + standby |

**Setup for users:** Settings → **Device Notifications** → Enable, then “Add to Home Screen” / Install on the phone or laptop.

HTTPS is required for push outside localhost (Lightsail with a domain + Let’s Encrypt).

## Google Calendar sync

Admins can pull **title, date, and time** from a Google Calendar into the app calendar (same shoot cards / statuses). Assignments and ops fields stay in the app.

1. In [Google Cloud Console](https://console.cloud.google.com/) create an OAuth client (Web application).
2. Add authorized redirect URI: `http://localhost:3001/api/google/callback` (or your live `/api/google/callback`).
3. Enable the **Google Calendar API**.
4. Put `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in `.env` / host variables; restart the API.
5. In the app: **Settings → Google Calendar → Connect**, pick a calendar, then **Sync**.
6. On **Calendar**, use **Sync Google** whenever Google changes.

### If Google shows `redirect_uri_mismatch` / `flowName=GeneralOAuthLite`

`flowName=GeneralOAuthLite` is Google’s internal label — the real problem is almost always the redirect URI.

1. Open **Settings → Google Calendar** and copy the shown redirect URI.
2. In Google Cloud Console → **APIs & Services → Credentials → your OAuth 2.0 Client ID**, paste that **exact** string under **Authorized redirect URIs**.
3. Do **not** include `?flowName=...`, a trailing slash, or a different port/host.
4. Client type must be **Web application** (not Desktop / iOS / Android).
5. If the consent screen is in **Testing**, add your Google account under **Test users**.
6. Restart the API after changing env vars, then try **Connect** again.

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
