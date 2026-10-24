#!/usr/bin/env bash
# De punta a punta: Neon -> migraciones -> seed -> Vercel -> prod.
# Uso: bash scripts/go-live.sh   (lee la key de ~/.config/neon-api-key o NEON_API_KEY)
set -euo pipefail
cd "$(dirname "$0")/.."

KEY="${NEON_API_KEY:-$(cat "$HOME/.config/neon-api-key" 2>/dev/null || true)}"
[ -z "$KEY" ] && { echo "Falta la API key de Neon." >&2; exit 1; }
export NEON_API_KEY="$KEY"
CLI="npx --yes neonctl@latest"
ORG="org-delicate-glitter-39647088"
PROJECT="cannabis-club"
REGION="aws-sa-east-1"

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
printf '%s' "$DIRECT" > "$HOME/.config/cannabis-club-db-url"
chmod 600 "$HOME/.config/cannabis-club-db-url"
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
printf '%s' "https://cannabis-club.vercel.app" | npx vercel env add APP_BASE_URL production --force >/dev/null
echo "ok"

echo "== 5/6 deploy =="
npx vercel deploy --prod --yes 2>&1 | tail -5

echo "== 6/6 listo =="
