#!/usr/bin/env bash
# Pull the latest code and restart the app on a Lightsail / VPS host.
# Usage: ./deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
PM2_NAME="${PM2_NAME:-remote-ops}"
# 1 GB hosts run out of memory during the Vite build without a cap
BUILD_MEMORY="${BUILD_MEMORY:-768}"

cd "$APP_DIR"

SAFE_BRANCH_RE='^(main|cursor/[a-z0-9][a-z0-9./_-]*)$'
if [ -n "${1:-}" ]; then
  if [[ ! "$1" =~ $SAFE_BRANCH_RE ]]; then
    echo "Refusing to deploy unsafe branch name: $1" >&2
    exit 1
  fi
  echo "==> Switching to $1"
  git fetch origin "$1"
  git checkout -B "$1" "origin/$1"
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "==> Deploying $PM2_NAME from $BRANCH in $APP_DIR"

echo "==> Fetching latest code"
git pull --ff-only origin "$BRANCH"

echo "==> Installing dependencies"
npm ci

echo "==> Building frontend"
NODE_OPTIONS="--max-old-space-size=$BUILD_MEMORY" npm run build

echo "==> Restarting app"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  pm2 start server/index.js --name "$PM2_NAME" --update-env
fi
pm2 save

echo "==> Health check"
HEALTH_URL="http://127.0.0.1:${PORT:-3001}/api/health"
ok=0
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if curl -fsS "$HEALTH_URL"; then
    echo
    ok=1
    break
  fi
  sleep 1
done
if [ "$ok" -ne 1 ]; then
  echo "Health check failed after 15s: $HEALTH_URL" >&2
  pm2 logs "$PM2_NAME" --nostream --lines 40 >&2 || true
  exit 1
fi

echo "==> Deploy complete"
