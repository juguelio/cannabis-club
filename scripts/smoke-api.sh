#!/usr/bin/env bash
# Smoke HTTP de punta a punta contra la app local y su base DESCARTABLE (escribe y muta datos).
# Uso: npm run db:seed && npm run dev   (en otra terminal)  →  DATABASE_URL=... bash scripts/smoke-api.sh
# Nunca contra producción: se niega si la base no es local.
set -u
case "${DATABASE_URL:-}" in *127.0.0.1*|*localhost*) ;; *) echo "DATABASE_URL no es local: no corro el smoke"; exit 1;; esac
B=${APP_URL:-http://localhost:3300}; J='content-type: application/json'
T=$(mktemp -d); A=$T/a.jar; O=$T/o.jar; S=$T/s.jar
pass=0; fail=0
check(){ if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "PASS $1 ($2)"; else fail=$((fail+1)); echo "FAIL $1 esperado $3 obtuvo $2"; fi; }
code(){ curl -s -o $T/body -w "%{http_code}" "$@"; }
PSQL="psql ${DATABASE_URL%%\?*} -tAc"
rm -f $A $O $S
check "health" "$(code $B/api/health)" 200
check "login admin" "$(code -c $A -X POST $B/api/auth/login -H "$J" -d '{"email":"admin@club.test","password":"Admin1234!"}')" 200
check "login operador" "$(code -c $O -X POST $B/api/auth/login -H "$J" -d '{"email":"operador@club.test","password":"Operador1234!"}')" 200
check "login socio" "$(code -c $S -X POST $B/api/auth/login -H "$J" -d '{"email":"maria@club.test","password":"Socio1234!"}')" 200
for i in 1 2 3 4 5; do code -X POST $B/api/auth/login -H "$J" -d '{"email":"nadie@club.test","password":"incorrecta"}' >/dev/null; done
check "6º intento fallido → 429" "$(code -X POST $B/api/auth/login -H "$J" -d '{"email":"nadie@club.test","password":"incorrecta"}')" 429
check "búsqueda sin tilde (gomez)" "$(code -b $A "$B/api/search?q=gomez")" 200; grep -q '"legajo":1' $T/body && check "gomez encuentra legajo 1" ok ok || check "gomez encuentra legajo 1" no ok
check "socio no busca" "$(code -b $S "$B/api/search?q=a")" 403
M3=$($PSQL "select id from \"Member\" where legajo=3"); M5=$($PSQL "select id from \"Member\" where legajo=5"); M2=$($PSQL "select id from \"Member\" where legajo=2"); M7=$($PSQL "select id from \"Member\" where legajo=7")
check "activar sin consentimiento → 422" "$(code -b $A -X PATCH $B/api/members/$M5 -H "$J" -d '{"status":"ACTIVO"}')" 422
check "suspender sin motivo → 422" "$(code -b $A -X PATCH $B/api/members/$M3 -H "$J" -d '{"status":"SUSPENDIDO"}')" 422
check "suspender con motivo" "$(code -b $A -X PATCH $B/api/members/$M3 -H "$J" -d '{"status":"SUSPENDIDO","statusReason":"REPROCANN vencido hace 2 meses"}')" 200
check "auditoría con antes→después" "$($PSQL "select count(*) from \"AuditLog\" where action='MEMBER_STATUS' and \"entityId\"='$M3' and payload->'changes'->'status'->>'from'='ACTIVO'")" 1
check "operador no corrige nombre → 403" "$(code -b $O -X PATCH $B/api/members/$M2 -H "$J" -d '{"lastName":"Otro"}')" 403
check "email inválido en castellano" "$(code -b $A -X PATCH $B/api/members/$M2 -H "$J" -d '{"email":"x"}')" 400; grep -q 'Email' $T/body && check "mensaje nombra el campo" ok ok || check "mensaje nombra el campo" no ok
check "acceso portal (clave temporal)" "$(code -b $A -X POST $B/api/members/$M7/access -H "$J" -d '{}')" 200
PW=$(python3 -c "import json;print(json.load(open('$T/body'))['password'])"); EM=$(python3 -c "import json;print(json.load(open('$T/body'))['email'])")
check "el socio entra con la clave temporal" "$(code -X POST $B/api/auth/login -H "$J" -d "{\"email\":\"$EM\",\"password\":\"$PW\"}")" 200
check "hash, no clave, en la base" "$($PSQL "select count(*) from \"User\" where email='$EM' and \"passwordHash\" like '\$2%'")" 1
B1=$($PSQL "select id from \"Batch\" where code='L-2026-001'"); M9x=$($PSQL "select id from \"Member\" where legajo=10"); B5=$($PSQL "select id from \"Batch\" where code='L-2026-005'"); B4=$($PSQL "select id from \"Batch\" where code='L-2026-004'")
check "entrega 2 g" "$(code -b $O -X POST $B/api/dispensations -H "$J" -d "{\"memberId\":\"$M7\",\"batchId\":\"$B1\",\"grams\":2}")" 201
check "misma entrega al toque → 409 DUPLICATE" "$(code -b $O -X POST $B/api/dispensations -H "$J" -d "{\"memberId\":\"$M7\",\"batchId\":\"$B1\",\"grams\":2}")" 409; grep -q DUPLICATE_SUSPECTED $T/body && check "código DUPLICATE_SUSPECTED" ok ok || check "código DUPLICATE_SUSPECTED" no ok
check "confirmada como otra → 201" "$(code -b $O -X POST $B/api/dispensations -H "$J" -d "{\"memberId\":\"$M7\",\"batchId\":\"$B1\",\"grams\":2,\"confirmDuplicate\":true}")" 201
K="smoke-$(date +%s%N)"
check "entrega con clave de intento" "$(code -b $O -X POST $B/api/dispensations -H "$J" -d "{\"memberId\":\"$M9x\",\"batchId\":\"$B1\",\"grams\":3,\"idempotencyKey\":\"$K\"}")" 201
check "reintento misma clave → 200 replay" "$(code -b $O -X POST $B/api/dispensations -H "$J" -d "{\"memberId\":\"$M9x\",\"batchId\":\"$B1\",\"grams\":3,\"idempotencyKey\":\"$K\"}")" 200
check "un solo asiento para esa clave" "$($PSQL "select count(*) from \"Dispensation\" where \"idempotencyKey\"='$K'")" 1
check "firma por defecto REGISTRO_OPERADOR" "$($PSQL "select \"signatureType\" from \"Dispensation\" where \"idempotencyKey\"='$K'")" REGISTRO_OPERADOR
check "etapa salteada → 422" "$(code -b $O -X PATCH $B/api/batches/$B5 -H "$J" -d '{"stage":"COSECHA"}')" 422
check "vegetativo → floración" "$(code -b $O -X PATCH $B/api/batches/$B5 -H "$J" -d '{"stage":"FLORACION"}')" 200
check "operador no destruye → 422" "$(code -b $O -X PATCH $B/api/batches/$B4 -H "$J" -d '{"stage":"DESTRUIDO","reason":"plaga de araña roja"}')" 422
check "cosecha húmeda" "$(code -b $O -X POST $B/api/batches/$B4/harvest -H "$J" -d '{"wetWeightG":800}')" 200
check "seco mayor que húmedo → 409" "$(code -b $O -X POST $B/api/batches/$B4/harvest -H "$J" -d '{"dryWeightG":900}')" 409
check "peso seco acredita" "$(code -b $O -X POST $B/api/batches/$B4/harvest -H "$J" -d '{"dryWeightG":12}')" 200
# agotar automáticamente: entregar los 12 g a dos socios activos
M9=$($PSQL "select id from \"Member\" where legajo=9"); M11=$($PSQL "select id from \"Member\" where legajo=11")
code -b $O -X POST $B/api/dispensations -H "$J" -d "{\"memberId\":\"$M9\",\"batchId\":\"$B4\",\"grams\":6}" >/dev/null
check "último gramo" "$(code -b $O -X POST $B/api/dispensations -H "$J" -d "{\"memberId\":\"$M11\",\"batchId\":\"$B4\",\"grams\":6}")" 201
check "lote pasa solo a AGOTADO" "$($PSQL "select stage from \"Batch\" where id='$B4'")" AGOTADO
D=$($PSQL "select id from \"Dispensation\" where \"batchId\"='$B4' and \"memberId\"='$M11'")
check "anular (ADMIN)" "$(code -b $A -X POST $B/api/dispensations/$D/void -H "$J" -d '{"reason":"Error de carga en mostrador"}')" 200
check "la anulación reabre el lote" "$($PSQL "select stage from \"Batch\" where id='$B4'")" DISPONIBLE
check "destruir (ADMIN) destruye el saldo" "$(code -b $A -X PATCH $B/api/batches/$B4 -H "$J" -d '{"stage":"DESTRUIDO","reason":"Muestra contaminada"}')" 200
check "destrucción de 6 g en el libro" "$($PSQL "select grams from \"StockMovement\" where \"batchId\"='$B4' and type='DESTRUCCION'")" 6.00
P=$($PSQL "select id from \"PickupRequest\" where status='SOLICITADA' limit 1")
check "marcar RETIRADA a mano ya no existe → 400" "$(code -b $O -X POST $B/api/pickups/$P/status -H "$J" -d '{"status":"RETIRADA"}')" 400
check "confirmar reserva" "$(code -b $O -X POST $B/api/pickups/$P/status -H "$J" -d '{"status":"CONFIRMADA"}')" 200
check "turno de la reserva confirmado" "$($PSQL "select a.status from \"Appointment\" a join \"PickupRequest\" p on p.\"appointmentId\"=a.id where p.id='$P'")" CONFIRMADO
check "cancelar reserva con motivo" "$(code -b $O -X POST $B/api/pickups/$P/cancel -H "$J" -d '{"reason":"El socio avisó que no viene"}')" 200
check "informe anual 2026" "$(code -b $A "$B/api/reports/informe-anual?anio=2026")" 200; head -1 $T/body | grep -q "Año" && check "encabezado con Año" ok ok || check "encabezado con Año" no ok
check "libro con rango" "$(code -b $A "$B/api/reports/dispensaciones?desde=2026-10-20&hasta=2026-10-21")" 200
check "fecha inválida → 400" "$(code -b $A "$B/api/reports/dispensaciones?desde=2026-13-40")" 400
check "libro inexistente → 404" "$(code -b $A "$B/api/reports/nada")" 404
CSV='Apellido;Nombre;DNI;Nacimiento;REPROCANN;Vencimiento\nNuevo;Socio;41000111;01/02/1995;REP-9;01/01/2027\nGómez;María;30111222;12/04/1988;;\nMal;X;12;xx;;'
check "import vista previa" "$(code -b $A -X POST $B/api/members/import -H "$J" -d "{\"csv\":\"$CSV\"}")" 200
python3 -c "import json;d=json.load(open('$T/body'));print('  preview',len(d['preview']),'skipped',len(d['skipped']),'issues',len(d['issues']))"
check "vista previa no escribe" "$($PSQL "select count(*) from \"Member\" where \"docNumber\"='41000111'")" 0
check "import commit" "$(code -b $A -X POST $B/api/members/import -H "$J" -d "{\"csv\":\"$CSV\",\"commit\":true}")" 200
check "importado como PENDIENTE" "$($PSQL "select status from \"Member\" where \"docNumber\"='41000111'")" PENDIENTE
check "operador no importa → 403" "$(code -b $O -X POST $B/api/members/import -H "$J" -d "{\"csv\":\"$CSV\"}")" 403
ADMIN_ID=$($PSQL "select id from \"User\" where email='admin@club.test'")
check "no te sacás el admin a vos mismo" "$(code -b $A -X PATCH $B/api/users/$ADMIN_ID -H "$J" -d '{"role":"OPERADOR"}')" 422
check "crear cuenta del equipo" "$(code -b $A -X POST $B/api/users -H "$J" -d '{"name":"Nueva Operadora","email":"nueva@club.test","role":"OPERADOR","password":"unaClaveLarga1"}')" 201
check "operador no ve el equipo → 403" "$(code -b $O $B/api/users)" 403
check "actividad (ADMIN)" "$(code -b $A "$B/api/audit?take=5")" 200
check "logout redirige" "$(code -b $A -X POST $B/api/auth/logout)" 303
for pth in / /socios /socios/$M2 /stock /stock/$B1 /dispensario /turnos /reportes "/configuracion?seccion=actividad" "/configuracion?seccion=equipo" "/configuracion?seccion=importar"; do
  check "página $pth" "$(code -b $O "$B$pth")" 200
  if [ "${pth:0:14}" = "/configuracion" ]; then
    grep -q 'NEXT_REDIRECT;replace;/;307' $T/body && ! grep -q 'Actividad del club\|Sumar a alguien\|Importar el padrón' $T/body && check "  operador redirigido sin datos" ok ok || check "  operador redirigido sin datos" no ok
  fi
done
check "portal 200" "$(code -b $S $B/portal)" 200
echo "TOTAL: $pass pass, $fail fail"; [ "$fail" = 0 ]
