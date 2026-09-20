#!/usr/bin/env bash
# Detached wrapper so Settings → Deploy survives the PM2 restart.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
BRANCH="${1:-}"
LOG_FILE="${DEPLOY_LOG_FILE:-$ROOT/server/data/deploy.log}"
STATUS_JS="$ROOT/server/deploy.js"

mkdir -p "$(dirname "$LOG_FILE")"
{
  echo "==== $(date -u +%Y-%m-%dT%H:%M:%SZ) deploy $BRANCH ===="
  ./deploy.sh "$BRANCH"
  code=$?
  echo "==== $(date -u +%Y-%m-%dT%H:%M:%SZ) finished with exit $code ===="
  node "$STATUS_JS" finish "$code" || true
  exit "$code"
} >> "$LOG_FILE" 2>&1
