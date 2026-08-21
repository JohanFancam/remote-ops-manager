#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm install
npm run build
npm run seed
echo ""
echo "ROM starting on http://localhost:4000"
echo "Demo: operator@rom.demo / rom123  (also admin@ / accounts@)"
echo ""
exec npm run start
