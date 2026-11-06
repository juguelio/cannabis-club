#!/usr/bin/env bash
# Deja el repo sin rastro del club piloto.
#
# Se corre DESPUÉS de cada sincronización con el piloto: los tests y algunos comentarios que vienen de
# allá usan el nombre del piloto como dato de ejemplo, y eso no tiene por qué viajar al repo de una
# instancia de cliente ni al template que se vende.
#
#   bash scripts/sanear-identidad.sh          # sanea y verifica
#   bash scripts/sanear-identidad.sh --dry    # sólo lista qué tocaría
#
# Toca fixtures de test y comentarios. No modifica datos de la base ni código de producción.
set -euo pipefail
cd "$(dirname "$0")/.."

PATRON='rep[uú]blica|republicaong'
ARCHIVOS=$(grep -rliE "$PATRON" --include='*.ts' --include='*.tsx' --include='*.md' --include='*.prisma' \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git \
  --exclude='sanear-identidad.sh' . || true)

if [ -z "$ARCHIVOS" ]; then
  echo "sin menciones: nada que sanear"
  exit 0
fi

if [ "${1:-}" = "--dry" ]; then
  echo "$ARCHIVOS"
  echo "archivos: $(echo "$ARCHIVOS" | wc -l | tr -d ' ')"
  exit 0
fi

echo "$ARCHIVOS" | while read -r f; do
  [ -f "$f" ] || continue
  perl -0pi -e '
    s/\(República entrega a distancia\)/(si el club entrega a distancia)/g;
    s/expect\(siglaOf\(DEFAULT_BRAND, "Asociación Civil República ONG"\)\)\.toBe\("R"\)/expect(siglaOf(DEFAULT_BRAND, "Asociación Civil Ejemplo Verde")).toBe("EV")/g;
    s/it\("República: fuente, gótica y afiche"/it("afiche: fuente de títulos y gótica del nombre"/g;
    s/https:\/\/republicacannabis\.com\.ar/https:\/\/club.test/g;
    s/republicacannabis/club/g;
    s/Asociación Civil República ONG/Asociación Civil El Bosque/g;
    s/República ONG/Club El Bosque/g;
    s/República/El Bosque/g;
    s/republica\.ong/club.ejemplo/g;
    s/republicaong/clubong/g;
    s/republica-2026/clave-larga-2026/g;
    s/\brepublica\b/ejemplo/g;
  ' "$f"
done

restantes=$(grep -rniE "$PATRON" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git . \
  | grep -v 'scripts/sanear-identidad.sh' | wc -l | tr -d ' ')
echo "menciones restantes: $restantes"
[ "$restantes" = "0" ]
