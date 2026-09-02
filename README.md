# The Assistant

Personal tasks + calendar in a installable web app.

## What’s in v1

- **Today** — greeting, due today, overdue, coming up
- **Tasks** — create / edit / complete / delete; Personal vs Work; priority
- **Calendar** — month view with tasks on due dates
- **Settings** — browser notifications, PWA install, defaults
- **Local-first** — data stored in your browser (`localStorage`)
- **PWA** — install to home screen (phone/desktop); service worker for offline shell

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

## Install on phone (no APK yet)

1. Open the app in Chrome (Android) or Safari (iOS)
2. **Add to Home Screen** / **Install app**
3. Enable notifications in Settings

A real `.apk` can be added later with Capacitor wrapping this same UI.

## Stack

Vite · React · Tailwind · Framer Motion · date-fns
