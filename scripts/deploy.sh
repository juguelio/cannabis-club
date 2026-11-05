#!/usr/bin/env bash
# Deploy a Vercel con la base que se le pase.
# Uso: DATABASE_URL="postgresql://..." APP_BASE_URL="https://tudominio.com" bash scripts/deploy.sh
# El proyecto de Vercel lo resuelve el CLI desde `.vercel/` o `--scope`: uno por club.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Falta DATABASE_URL (Postgres accesible desde Vercel, con sslmode=require)." >&2
  exit 1
fi

echo "== migraciones contra la base de producción =="
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy

echo "== datos iniciales (club demo + admin) =="
DATABASE_URL="$DATABASE_URL" npm run db:seed

echo "== variables de entorno en Vercel =="
printf '%s' "$DATABASE_URL" | npx vercel env add DATABASE_URL production --force >/dev/null
if ! npx vercel env ls production 2>/dev/null | grep -q AUTH_SECRET; then
  openssl rand -hex 32 | npx vercel env add AUTH_SECRET production --force >/dev/null
fi
printf '%s' "${APP_BASE_URL:?Falta APP_BASE_URL}" | npx vercel env add APP_BASE_URL production --force >/dev/null

echo "== deploy =="
npx vercel deploy --prod --yes
