# Remote Ops Manager — deploy guide (simple)
#
# Goal: get a public URL so you can register accounts and test.
# You keep editing in Cursor/GitHub afterwards; Railway can auto-update the live site.

## What I already prepared in this repo
- Production Docker build
- Persistent storage paths (`/data` for SQLite + uploads)
- Health check at `/api/health`
- Register page at `/register`
- Login page at `/login`

## What only YOU can do first
I cannot create a hosting account in your name. Step 1 below is yours (about 2 minutes).
After that, I can keep guiding every click.

---

## Step 1 — Create a free Railway account (do this first)
1. Open: https://railway.app
2. Click **Login** / **Start a New Project**
3. Choose **Login with GitHub**
4. Approve access to your GitHub (JohanFancam)

Reply here when that is done: “Railway account ready”.

---

## Step 2 — Deploy this repo (after Step 1)
1. In Railway: **New Project**
2. Choose **Deploy from GitHub repo**
3. Select: `JohanFancam/remote-ops-manager`
4. If asked for branch, pick `main` (or `cursor/modern-standalone-a34f` until merged)
5. Wait until the first deploy finishes (a few minutes)

## Step 3 — Add permanent storage (important)
SQLite must be saved on a disk or your data disappears on restart.
1. Open your Railway service
2. Go to **Settings** → **Volumes** (or “Add Volume”)
3. Mount path: `/data`
4. Save / redeploy if prompted

## Step 4 — Set secrets (Variables)
In Railway → Variables, add:

```text
JWT_SECRET=f9b9983e46fdc57e8337ad49e2c53468d2d949f5512aee8e3141082a64635696
DATABASE_PATH=/data/remote-ops.db
UPLOADS_DIR=/data/uploads
NODE_ENV=production
```

Optional — Google Calendar sync (after you create OAuth credentials in Google Cloud):

```text
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://YOUR-URL/api/google/callback
FRONTEND_URL=https://YOUR-URL
```

(You can replace JWT_SECRET later with any long random string.)

## Step 5 — Get your public link
1. Railway → Settings → **Networking** / **Public Networking**
2. Click **Generate Domain**
3. Copy the URL (looks like `https://....up.railway.app`)

## Step 6 — Create your test accounts
1. Open: `https://YOUR-URL/register`
2. Create account 1 (your admin/operator)
3. Create account 2 (second tester)
4. Or login with seeded demo first:
   - `admin@example.com` / `admin123`
   - `operator@example.com` / `operator123`

## Editing afterwards
- **In the live app:** create/edit shoots, approve, settings, users — all normal.
- **In the code:** keep using Cursor. When changes are merged/pushed to the connected branch, Railway redeploys automatically.
- You do **not** need to rebuild locally for normal use.

## If something fails
Tell me the Railway deploy log error text and I’ll fix the repo and guide the next click.
