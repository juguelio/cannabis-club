#!/usr/bin/env bash
# Provisiona una base Neon para el club y devuelve el DATABASE_URL.
# Requiere NEON_API_KEY en el entorno (o en ~/.config/neon-api-key).
set -euo pipefail
cd "$(dirname "$0")/.."

KEY="${NEON_API_KEY:-$(cat "$HOME/.config/neon-api-key" 2>/dev/null || true)}"
if [ -z "$KEY" ]; then echo "Falta NEON_API_KEY (o ~/.config/neon-api-key)" >&2; exit 1; fi
export NEON_API_KEY="$KEY"
CLI="npx --yes neonctl@latest"
PROJECT="${1:-cannabis-club}"
REGION="${2:-aws-sa-east-1}"

echo "== proyectos actuales =="
$CLI projects list 2>&1 | head -20

if ! $CLI projects list 2>/dev/null | grep -q "$PROJECT"; then
  echo "== creando $PROJECT en $REGION =="
  $CLI projects create --name "$PROJECT" --region-id "$REGION" 2>&1 | tail -20
else
  echo "== $PROJECT ya existe =="
fi

echo "== connection string (pooled) =="
$CLI connection-string "$PROJECT" --pooled 2>&1 | tail -3
