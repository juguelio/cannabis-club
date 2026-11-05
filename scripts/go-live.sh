#!/usr/bin/env bash
# De punta a punta: Neon -> migraciones -> seed -> Vercel -> prod.
# Uso: NEON_ORG=org-... NEON_PROJECT=club-<nombre> APP_BASE_URL=https://tudominio.com \
#        bash scripts/go-live.sh
# La key de Neon sale de NEON_API_KEY o de ~/.config/neon-api-key.
# Nada de esto tiene valores de un club: cada despliegue se parametriza por entorno.
set -euo pipefail
cd "$(dirname "$0")/.."

KEY="${NEON_API_KEY:-$(cat "$HOME/.config/neon-api-key" 2>/dev/null || true)}"
[ -z "$KEY" ] && { echo "Falta la API key de Neon." >&2; exit 1; }
export NEON_API_KEY="$KEY"
CLI="npx --yes neonctl@latest"
ORG="${NEON_ORG:?Falta NEON_ORG (id de la organización de Neon)}"
PROJECT="${NEON_PROJECT:?Falta NEON_PROJECT (nombre del proyecto, uno por club)}"
REGION="${NEON_REGION:-aws-sa-east-1}"
SITE="${APP_BASE_URL:?Falta APP_BASE_URL (dominio público, con https://)}"

echo "== 1/6 proyecto Neon =="
if ! $CLI projects list --output json 2>/dev/null | grep -q "\"name\": \"$PROJECT\""; then
  $CLI projects create --name "$PROJECT" --region-id "$REGION" --org-id "$ORG" --output json > /tmp/neon-create.json
  head -c 300 /tmp/neon-create.json; echo
else
  echo "ya existe"
fi
sleep 5

DIRECT="$($CLI connection-string "$PROJECT" --org-id "$ORG" 2>/dev/null | tail -1)"
POOLED="$($CLI connection-string "$PROJECT" --org-id "$ORG" --pooled 2>/dev/null | tail -1)"
[ -z "$DIRECT" ] && { echo "No pude obtener el connection string" >&2; exit 1; }
mkdir -p "$HOME/.config"
printf '%s' "$DIRECT" > "$HOME/.config/$PROJECT-db-url"
chmod 600 "$HOME/.config/$PROJECT-db-url"
HOST="$(printf '%s' "$DIRECT" | sed -E 's#.*@([^/:]+).*#\1#')"
echo "host de la base: $HOST"

echo "== 2/6 migraciones =="
DATABASE_URL="$DIRECT" npx prisma migrate deploy

echo "== 3/6 datos iniciales =="
DATABASE_URL="$DIRECT" npm run db:seed

echo "== 4/6 variables en Vercel =="
RUNTIME="$POOLED"
case "$RUNTIME" in *"?"*) RUNTIME="$RUNTIME&pgbouncer=true&connect_timeout=15";; *) RUNTIME="$RUNTIME?pgbouncer=true&connect_timeout=15";; esac
printf '%s' "$RUNTIME" | npx vercel env add DATABASE_URL production --force >/dev/null
printf '%s' "$DIRECT"  | npx vercel env add DIRECT_URL production --force >/dev/null
openssl rand -hex 32 | npx vercel env add AUTH_SECRET production --force >/dev/null
printf '%s' "$SITE" | npx vercel env add APP_BASE_URL production --force >/dev/null
# Los correos necesitan nombre y, si hay logo, una URL absoluta: ver src/lib/site.ts.
[ -n "${CLUB_NOMBRE:-}" ] && printf '%s' "$CLUB_NOMBRE" | npx vercel env add CLUB_NOMBRE production --force >/dev/null
echo "ok"

echo "== 5/6 deploy =="
npx vercel deploy --prod --yes 2>&1 | tail -5

echo "== 6/6 listo =="
