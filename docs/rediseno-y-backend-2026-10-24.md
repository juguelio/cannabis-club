# Rediseño y backend — 24/10/2026 (rama `feat/next-level-ui-backend`)

Base: `origin/main` en `907b6b1` (incluye R01–R07 del REA de operación). Sin cambios de esquema.

## Qué cambia para el mostrador

- **Búsqueda global** (Ctrl/⌘ K o `/`): legajo, apellido (sin importar tildes), DNI, REPROCANN o lote. ⇧↵ abre la entrega del socio.
- **Dispensario como balanza**: cola de esperados (turnos + reservas), lotes como opciones, gramos en grande,
  medidores de mes y día (retirado + lo de ahora), veredicto antes de confirmar, comprobante al terminar.
  Una reserva se cierra sólo si se atiende explícitamente (R01) y se puede soltar con «No es la reserva».
- **Doble registro**: la misma intención no duplica (clave de intento, R07) y una entrega idéntica con otra clave
  en menos de un minuto pide confirmación («Es otra entrega»).
- **Legajo**: estado con motivo (suspender y dar de baja lo exigen; activar exige consentimiento), edición en diálogo,
  historial de cambios con antes→después, carnet QR y acceso al portal con clave temporal que se ve una sola vez.
- **Lotes**: ficha con libro, totales y «a quién se entregó» (retiro preventivo); ciclo de etapas con reglas
  (`src/lib/batch-rules.ts`); el lote se agota solo con el último gramo y se reabre si una anulación devuelve stock;
  destruir (sólo ADMIN) registra la destrucción del saldo.
- **Libros**: dispensaciones y destrucciones por rango de fechas; informe anual por año (antes sumaba todo el historial).
- **Configuración** (ADMIN): club y reglas · equipo (alta, rol, clave, desactivar; nunca te quedás sin admin) ·
  importar padrón desde CSV (vista previa sin escribir, entran como pendientes) · actividad del club.
- **Ingreso**: 5 intentos fallidos por email en 15 min → 429; quedan como `LOGIN_FAILED` en la auditoría.

## API nueva

| Ruta | Rol | Qué hace |
|---|---|---|
| `GET /api/search?q=` | staff | socios y lotes |
| `GET/PATCH /api/batches/[id]` | staff (destruir: ADMIN) | ficha con trazabilidad · etapa, sala, plantas, notas |
| `POST/DELETE /api/members/[id]/access` | staff | acceso al portal con clave temporal · quitarlo |
| `POST /api/members/import` | ADMIN | `{csv, commit}`: vista previa o importación en una transacción |
| `GET/POST /api/users`, `PATCH /api/users/[id]` | ADMIN | equipo |
| `GET /api/audit` | ADMIN | actividad paginada por cursor |
| `POST /api/pickups/[id]/cancel` | staff | cancelar reserva con motivo |
| `GET /api/health` | público | vida + base, sin datos |
| `GET /api/reports/[name]?desde=&hasta=&anio=` | staff | libros por período |

`POST /api/pickups/[id]/status` sólo acepta `CONFIRMADA` (y confirma el turno asociado).

## Verificación

- `npm test` 76/76 · `tsc` 0 · `lint` 0 · `npm run build` OK.
- `bash scripts/smoke-api.sh` (base local descartable, se niega con una base no local): 72/72.
- Capturas a 1360 y 390 px de todas las pantallas; sin desborde horizontal salvo 2 px en Actividad a 390 px.

## No probado

- Nada de esto corrió contra la base de producción (Neon) ni en Vercel.
- Lectura del QR con un celular real.
- Importación de un padrón real del club.
