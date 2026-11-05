#!/usr/bin/env bash
# Arregla el orden de la migración del domicilio (ver docs/migracion-orden-domicilio.md).
#
# Por qué existe: `20261102010000_domicilio_en_la_validacion` ordena antes que
# `20261102140000_revalidacion_dni_reprocann`, que es la que crea `MemberVerification`.
# Una base nueva falla al migrar. En una base que ya migró hay que renombrar el registro de
# bookkeeping ANTES de renombrar la carpeta, o el próximo `migrate deploy` intenta recrear
# columnas existentes.
#
# Uso:
#   DATABASE_URL="postgresql://..." bash scripts/fix-migracion-domicilio.sh          # dry-run
#   DATABASE_URL="postgresql://..." bash scripts/fix-migracion-domicilio.sh --si     # ejecuta
set -euo pipefail
cd "$(dirname "$0")/.."

VIEJA="20261102010000_domicilio_en_la_validacion"
NUEVA="20261102170000_domicilio_en_la_validacion"
SI="${1:-}"

[ -z "${DATABASE_URL:-}" ] && { echo "Falta DATABASE_URL." >&2; exit 1; }
# psql no acepta los parámetros de query de Prisma (`?schema=public`): se los saco sólo para él.
PGURL="${DATABASE_URL%%\?*}"

echo "== base =="
echo "host: $(printf '%s' "$DATABASE_URL" | sed -E 's#.*@([^/:?]+).*#\1#')"
psql "$PGURL" -tAc "SELECT count(*) FROM _prisma_migrations WHERE migration_name IN ('$VIEJA','$NUEVA')" \
  | sed 's/^/registros que matchean: /'

echo "== 1/2 registro en _prisma_migrations =="
if psql "$PGURL" -tAc "SELECT 1 FROM _prisma_migrations WHERE migration_name='$NUEVA'" | grep -q 1; then
  echo "ya está renombrado, nada que hacer"
elif ! psql "$PGURL" -tAc "SELECT 1 FROM _prisma_migrations WHERE migration_name='$VIEJA'" | grep -q 1; then
  echo "no hay registro '$VIEJA' en esta base: no es la base del club o ya se migró a mano" >&2
  exit 1
else
  if [ "$SI" = "--si" ]; then
    psql "$PGURL" -c "UPDATE _prisma_migrations SET migration_name='$NUEVA' WHERE migration_name='$VIEJA'"
    echo "registro renombrado"
  else
    echo "[dry-run] UPDATE _prisma_migrations SET migration_name='$NUEVA' WHERE migration_name='$VIEJA';"
  fi
fi

echo "== 2/2 carpeta =="
if [ -d "prisma/migrations/$NUEVA" ]; then
  echo "la carpeta ya se llama $NUEVA"
elif [ -d "prisma/migrations/$VIEJA" ]; then
  if [ "$SI" = "--si" ]; then
    git mv "prisma/migrations/$VIEJA" "prisma/migrations/$NUEVA"
    echo "carpeta renombrada: falta commit"
  else
    echo "[dry-run] git mv prisma/migrations/$VIEJA prisma/migrations/$NUEVA"
  fi
else
  echo "no encuentro ninguna de las dos carpetas" >&2
  exit 1
fi

echo "== verificación =="
if [ "$SI" = "--si" ]; then
  npx prisma migrate status | tail -3
  echo "Ahora commitear el rename y, en una base descartable, correr migrate deploy + db:seed."
else
  echo "[dry-run] nada se tocó. Repetir con --si cuando la base destino sea la correcta."
fi
