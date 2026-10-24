# Turnos del dispensario

## Qué resuelve

Con más de ~50 socios el mostrador se satura: todos llegan a la misma hora y el operador no sabe
quién viene, quién canceló ni cuánta gente tiene el día. Los turnos ordenan la demanda sin tocar el
libro de entregas: **un turno no habilita nada**, sólo reserva una franja.

## Modelo

- `ScheduleRule` — franjas de atención: `weekday` (0 = domingo), `startMin`/`endMin` (minutos desde
  medianoche en hora del club), `slotMin` (duración del turno) y `capacity` (**socios por turno**, no
  por día). Seed: lunes a sábado 10:00–19:00, turnos de 20 min, cupo 2.
- `Appointment` — turno reservado: socio, `scheduledAt` en UTC, estado, canal, notas y
  `dispensationId` cuando la entrega se registra.
- Estados: `PENDIENTE → CONFIRMADO → ATENDIDO | AUSENTE`, con `CANCELADO` desde los dos primeros.
  `ATENDIDO`, `AUSENTE` y `CANCELADO` son terminales: no se reabren (si hace falta, se reserva otro).

## Reglas de negocio

1. **Reservar no habilita la entrega.** El dispensario vuelve a validar REPROCANN, topes diario/mensual
   y stock del lote al momento de entregar. Un turno con REPROCANN vencido se puede reservar y se
   bloquea en el mostrador: es mejor que el socio venga y se le explique que rechazarlo por teléfono.
2. **Un turno por socio por día** (`DUPLICATE_DAY`), salvo que el anterior esté cancelado.
3. **Cupo por horario**, no por día: dos socios pueden compartir las 10:20 si `capacity = 2`.
4. **Cada hora tiene un único instante**: el cálculo de cupo compara `scheduledAt` exacto, así que la
   grilla y el alta tienen que usar el mismo redondeo (minutos desde medianoche).
5. **Cancelar exige motivo** (`CANCEL_REASON_REQUIRED`); queda en `cancelReason` y en el audit log.
6. **La validación vive dos veces**: en pantalla (`/api/appointments` con la grilla) y dentro de la
   transacción `Serializable` del alta. La primera es para el operador; la segunda es la que manda.
7. Nada de turnos en el pasado (`PAST`) ni fuera de franja (`NO_SLOT`).

## API

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/api/appointments?date=YYYY-MM-DD` | grilla del día, turnos, resumen y franjas |
| POST | `/api/appointments` | reservar `{memberId, date, startMin, channel?, notes?}` |
| POST | `/api/appointments/{id}/status` | `{status, reason?}` con transiciones validadas |

Errores: 422 `PAST` / `NO_SLOT` / `SLOT_FULL` / `MEMBER_INACTIVE` / `DUPLICATE_DAY` /
`CANCEL_REASON_REQUIRED`; 409 `INVALID_TRANSITION`.

## Pantalla

`/turnos`: navegación por día (‹ Hoy ›), chips de resumen (por llegar, atendidos, no vinieron,
cancelados), grilla de franjas con cupo (`1/2 · 1 libre`), formulario **horario → socio → canal** y
tabla del día con acciones jerarquizadas: la principal (Confirmar / Entregar) y el resto plegado en
"Más". "Entregar" abre el dispensario con el socio preseleccionado (`/dispensario?socio=<id>`).

## Trampas pagadas

- **Etiquetar la hora restando en el lugar equivocado**: `scheduledAt` viene en UTC y el club está en
  -03:00; sumar 3 h en vez de restar mostró turnos 6 h corridos (10:20 → 16:20). Usar `labelOf()`, que
  aplica el offset del club, y testearlo con un instante que cruce medianoche.
- **El `let` que nunca se reasigna**: `date.setUTCDate()` muta, no reasigna. ESLint lo marca
  (`prefer-const`) y corta el build de Vercel.
- **Cupo contado con `appointments` de todos los socios**: para el cupo hace falta la lista completa del
  día; para el duplicado, sólo la del socio. `evaluateBooking` acepta `memberAppointments` aparte.
- **Scripts de seed destructivos**: `prisma/seed.ts` borra todo. Contra producción usar
  `scripts/seed-turnos.ts`, que sólo agrega franjas faltantes y turnos si el día está vacío.
