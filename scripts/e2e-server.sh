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

set -a
# shellcheck disable=SC1091
. ./.env
set +a

export DATABASE_URL="${DATABASE_URL/cannabis_club_dev/cannabis_club_e2e}"
export DIRECT_URL="$DATABASE_URL"
export AUTH_SECRET="${AUTH_SECRET:-e2e-secreto-solo-para-tests-0000000000}"
# Los documentos del legajo se guardan cifrados y `DOC_ENC_KEY` no está en .env (vive en Vercel):
# sin clave, subir un documento tira «DOC_ENC_KEY no está configurada» y el trámite no se prueba.
export DOC_ENC_KEY="${DOC_ENC_KEY:-MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=}"
export NODE_ENV=production

npx tsx e2e/reset-db.ts

exec npx next start -p 3500
