#!/usr/bin/env bash
# Bring-up completo en un comando: base local + migraciones + seed + dev server.
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/dev-db.sh start
npx prisma migrate deploy
npm run db:seed
exec npm run dev
