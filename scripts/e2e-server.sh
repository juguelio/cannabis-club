#!/usr/bin/env bash
# Levanta la app para los tests E2E: base propia, puerto 3500, build de producción.
#
# Orden que importa: **primero se rehace la base, después arranca el servidor**. Al revés, tirar la
# base con el pool de Prisma ya conectado rompe todas las consultas del servidor.
#
# No toca `cannabis_club_dev` (se reemplaza el nombre de la base) ni el 3000 (bridge de WhatsApp)
# ni el 3300 (next dev). Requiere el build hecho: `npm run build`.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .next/BUILD_ID ]; then
  echo "[e2e] falta el build. Corré: npm run build" >&2
  exit 1
fi

export DATABASE_URL="$(npx tsx -e 'import { E2E_DATABASE_URL } from "./e2e/env"; console.log(E2E_DATABASE_URL)')"
export DIRECT_URL="$DATABASE_URL"
export AUTH_SECRET="${E2E_AUTH_SECRET:?Iniciá la suite con Playwright}"
export DOC_HASH_KEY="e2e-indice-solo-para-tests"
export DOC_ENC_KEY="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
export APP_BASE_URL="http://127.0.0.1:3500"
export NODE_ENV=production
export RESEND_API_KEY=""
npx tsx e2e/reset-db.ts
exec npx next start --hostname 127.0.0.1 -p 3500
