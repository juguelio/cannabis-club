# REA — operación diaria del administrador

Fecha de evidencia: **2026-10-24**. Autor: Codex. Repo inspeccionado: `/Users/altostake/Dev/cannabis-club`, HEAD `9aedd2599144863aaf67813b753f478d8d1a4d1c`, árbol limpio al iniciar. **Diagnóstico y propuesta: no se modificó código ni producción.**

## Conclusión

El siguiente salto de producto consiste en conectar correctamente **reserva → atención → entrega → comprobante → conciliación**. Ya existen portal, turnos, ledger y configuración; sumar más módulos antes de cerrar ese circuito amplificaría inconsistencias.

Prioridad recomendada: corregir estados y cálculo de cupos, después construir un mostrador centrado en la persona atendida y finalmente reportes verificables y gestión de excepciones.

## Método y límites

- Se contrastaron fuentes primarias: documentación operativa pública de Cannanas y páginas oficiales de HerbTrack y Canopi. Documentación del proveedor acredita un flujo documentado; una página comercial acredita una declaración, no su ejecución real.
- Se inspeccionaron rutas, modelos, consultas y componentes del repo actual. Se ejecutaron cuatro casos sintéticos directamente contra `evaluateDispensation`, sin base de datos ni escrituras operativas.
- No se accedió a cuentas privadas de competidores ni se ejecutaron sus procesos. No se compró, reservó ni entregó producto.
- La herramienta de navegador bloqueó abrir la vista local en esta sesión. No se intentó eludir el bloqueo. **No hay QA visual nuevo ni mediciones de clics/tiempos**; las observaciones de nuestra UI provienen de componentes. Las capturas anteriores no prueban esta versión.
- Grow Club Manager no pudo consultarse con la herramienta web; no se reutilizó la nota anterior como prueba actual. GreenClub sólo produjo un resultado de búsqueda, insuficiente para incluirlo en la comparación.
- No se evaluó normativa argentina ni se transfieren obligaciones alemanas/españolas. Los patrones propuestos son de operación y calidad del software.
- El canon registra publicación y revalidación por HAL de mejoras anteriores. Este REA no revalida producción ni afirma que todos los escenarios se hayan materializado con datos reales.

## Qué aporta la comparación

| Fuente primaria | Evidencia consultada | Patrón aprovechable |
|---|---|---|
| [Cannanas: realizar entrega](https://support.cannanas.club/docs/clubs/abgabe/abgabe-durchfuehren) | Manual paso a paso: abrir desde reserva, cargar socio/productos, revisar información, confirmar y ver un comprobante con identificador. | Una operación conserva su contexto de principio a fin. |
| [Cannanas: editar reservas](https://support.cannanas.club/docs/clubs/abgabe/reservierung-aktualisieren) | Documenta reprogramación sin entrega y lista de preparación para reservas seleccionadas. | Separar planificación de ejecución y facilitar preparación del día. |
| [Cannanas: reglas de reserva](https://cannanas.club/funktionen/reservierungssystem) | Página funcional: horarios, pausas, cierres, anticipación y cancelaciones configurables. | El calendario debe poder representar excepciones reales. |
| [Cannanas: informes](https://support.cannanas.club/docs/clubs/berichte/uebersicht) | Manual: año/mes, vista previa, exportación y opciones de privacidad. | El reporte debe explicitar período, alcance y datos personales. |
| [Cannanas: trazabilidad](https://cannanas.club/funktionen/track-and-trace) | Declara identificación por lote, afectados por recall y bloqueo de entrega del lote señalado. | Convertir relaciones de base en una herramienta de respuesta a incidentes. |
| [Cannanas: laboratorio](https://support.cannanas.club/docs/clubs/anbau/laborportal/) | Manual: análisis asociado a cosecha, valores, adjuntos y estados pendiente/aprobado/rechazado. | “Dato no cargado” debe distinguirse de “control superado”. |
| [HerbTrack: software](https://herbtrack.de/en/csc-software) | Declara chequeos antes de entregar, inventario y reportes conectados. | Conservar el bloqueo transaccional que ya tiene el repo. No demuestra detalles internos. |
| [Canopi: funcionalidades](https://canopi.es/en/features) | Declara ficha unificada, historial, correcciones trazables, roles y cierre diario de caja. | Adaptar el cierre al libro de stock del club; no copiar su POS ni asumir que su caja es necesaria. |

## Hallazgos prioritarios

**P1** = corregir antes de confiar en el flujo afectado. **P2** = siguiente mejora operativa. **P3** = posterior. No se asigna P0: no se probó una pérdida real de datos ni un incidente en producción.

### R01 · P1 — “Retirada” puede existir sin entrega

**Observado en código:** `src/components/pickup-actions.tsx` ofrece “Marcar retirada”. `src/lib/pickups.ts:318–331` cambia estado y fecha sin crear ni exigir `Dispensation`, movimiento o auditoría. El endpoint admite ese estado. Por separado, `dispense` toma la reserva abierta más antigua del socio (`src/lib/dispensary.ts:132`), sin recibir el ID elegido ni comparar los gramos o el día.

**Consecuencia inferida:** una reserva puede desaparecer del pendiente sin descontar stock; una entrega de 5 g puede cerrar una reserva de 20 g o una futura. El enlace desde Turnos pasa sólo `socio`, no `appointmentId`; los turnos sin reserva no quedan necesariamente vinculados a su entrega.

**Propuesta:** botón “Atender esta reserva”; transportar `pickupId` y `appointmentId`; cargar socio y cantidad; validar pertenencia, estado y diferencia de gramos; cerrar exclusivamente ese contexto en la transacción de entrega. Si se permite retiro parcial, modelar el remanente explícitamente. Definir cómo queda la reserva cuando se anula su entrega.

**Aceptación:** no hay RETIRADA sin entrega trazable; una reserva de mañana no se cierra por una entrega de hoy; 5/20 g no cierra 20 g silenciosamente; anular no deja un retiro vigente ambiguo.

### R02 · P1 — Las anulaciones pueden aumentar el cupo de otro día

**Observado:** `src/lib/dispensary.ts:10–30` calcula uso restando reversas por la fecha de la reversa, no por la operación anulada.

**Escenario inferido desde SQL:** entrega de 5 g ayer, anulada hoy, sin otras entregas hoy → uso diario -5 g. La prueba pura de R02 confirmó que con ese uso, un pedido de 30 g pasa un tope diario de 25 g (`dayAfter=25`). **No se ejecutó ese historial contra Postgres en esta sesión.**

**Propuesta:** conservar el ledger físico por fecha del movimiento, pero calcular el uso del período por fecha de la entrega original y su estado efectivo. Definir correcciones entre meses y cierre histórico; no basta con ocultar los negativos en pantalla.

**Aceptación:** anular ayer no regala cupo hoy; idem cambio de mes; mismo día devuelve sólo el cupo correspondiente; el stock sigue cuadrando.

### R03 · P1 — Desconocido puede presentarse como habilitado

**Observado/reproducido:** `src/lib/limits.ts:113–122` permite estado VIGENTE sin fecha de vencimiento. El control de THC sólo compara si el valor existe: un socio de 19 años y lote con THC `null` obtiene `OK`, aunque su configuración tenga máximo 10 %.

**Además:** `daysToExpiry` usa `Math.ceil` (`src/lib/labels.ts:90`), mientras la entrega compara instantes. Un vencimiento almacenado a medianoche UTC puede aparecer con 0 días y ser rechazado al entregar. La prueba con vencimiento 24/10 y atención 24/10 15:00Z devolvió `REPROCANN_EXPIRED`.

**Propuesta:** un único evaluador de elegibilidad usado por portal, previa y escritura; distinguir pendiente de verificación, habilitado y bloqueado. Definir con el club la semántica del día de vencimiento y los campos obligatorios; evitar afirmar aprobación cuando faltan datos necesarios para el control. Consentimiento hoy es un campo, no una condición dentro del evaluador: decidir su política, no inventarla.

**Aceptación:** la misma entrada produce el mismo motivo en las tres superficies; THC desconocido no equivale a THC bajo; una fecha incompleta se señala; pruebas de día límite y zona horaria.

### R04 · P1 — Reserva futura calculada con consumo de hoy

**Observado:** `createPickup` consulta `memberUsage` del momento actual; no del día/mes del retiro. Descuenta pendientes del propio socio pero `stockTotal` no resta reservas de otros socios. Si encuentra un turno abierto del socio ese día, lo reutiliza aunque el horario pedido sea otro (`src/lib/pickups.ts`, funciones `createPickup`, `stockTotal`).

**Consecuencia inferida:** haber retirado hoy puede bloquear mañana; un cambio de mes usa el cupo incorrecto; varios socios pueden reservar el mismo saldo físico. Esto no implica stock negativo al entregar: allí vuelve a validarse, pero sí una promesa de disponibilidad ambigua.

**Propuesta:** decidir si es “solicitud sujeta a disponibilidad” o reserva con compromiso. Si compromete, mantener stock reservado global y liberarlo al cancelar/vencer; medir cupo por fecha elegida. Mostrar y confirmar la reutilización de un turno existente.

**Aceptación:** casos hoy/mañana/mes siguiente, dos socios frente al último saldo y selección de un horario distinto al ya reservado.

### R05 · P1 — El informe “anual” no filtra por año

**Observado:** `src/lib/reports.ts:165–205` agrega todo el historial; no recibe período. `src/app/api/reports/[name]/route.ts` tampoco toma año/mes. Las columnas “THC % prom” y “CBD % prom” usan valores de `Strain`, no un promedio calculado de lotes o entregas.

**Propuesta:** año/mes explícitos, saldo de apertura y al cierre, filtros temporales consistentes y vista previa. Definir promedio ponderado o renombrar la columna como valor de referencia. CSV con período en el nombre y alcance visible. Neutralizar fórmulas en campos textuales exportados: `toCsv` escapa separadores/comillas pero no los prefijos de fórmula.

**Aceptación:** datos de dos años no se mezclan; apertura + entradas − salidas = cierre; los valores que se llaman promedio se calculan como tal; nombres que empiezan con `=` se exportan como texto.

### R06 · P1 — El comprobante dice PIN sin verificar un PIN

**Observado:** `src/components/dispensary-console.tsx:69` envía `signatureType: "PIN"`; no captura PIN. `src/lib/dispensary.ts:96` lo guarda por defecto y acepta referencia vacía.

**Propuesta:** separar “registrado por operador” de evidencia de recepción. No llamar firma/PIN a una selección fija. Si se requiere confirmación del socio, diseñar un mecanismo verificable y su referencia; esto no acredita firma legal por sí solo.

**Aceptación:** ninguna entrega dice PIN verificado sin evidencia; comprobante con ID, socio, lote, gramos, operador, fecha y método real.

## Mejoras de experiencia y operación

| ID / prioridad | Brecha observada y propuesta | Criterio de aceptación |
|---|---|---|
| R07 / P2 | **Mostrador centrado en la atención.** Hoy el selector precarga el primer socio, primer lote y 5 g; las reservas quedan debajo. Incorporar búsqueda por nombre/DNI/legajo, contexto de reserva, resumen antes de confirmar y recibo después. Agregar clave de idempotencia en backend: `busy` no cubre un reintento tras perder la respuesta. | Reintentar la misma intención produce un único asiento; nuevo retiro requiere nueva intención; nunca queda un socio elegido accidentalmente por orden alfabético. |
| R08 / P2 | **Vencimientos anticipados.** Panel y filtro detectan problemas existentes; falta una bandeja 7/15/30 días y documentación incompleta. | Cada alerta abre el legajo exacto y desaparece al resolverlo; define dueño y siguiente acción. Avisos externos quedan para fase separada. |
| R09 / P2 | **Lote y retiro preventivo.** Hay relación lote→entregas→socio, pero no pantalla de detalle/recall ni cuarentena específica. Agregar ficha con procedencia, análisis, movimientos, receptores afectados y bloqueo con motivo/actor. | Un lote bloqueado no se entrega; lista de afectados sale del registro real; no se destruye stock para simular cuarentena. |
| R10 / P2 | **Cierre operativo y auditoría visible.** Hay AuditLog sin pantalla de consulta, CSV sin conciliación diaria y escrituras que aún usan `audit()` best effort. Añadir balance del día por lote, diferencias, anulaciones y eventos filtrables; snapshot de cierre, sin editar ledger. | Cada diferencia tiene motivo y responsable; cierre indica período, saldo inicial/final y correcciones posteriores. No implica módulo contable. |
| R11 / P2 | **Calendario administrable.** ScheduleRule existe, pero no UI de reglas/cierres/reprogramación. `expireStale` vence por creación a 7 días, no por cita, y no actualiza el turno vinculado. Cancelar reserva valida fuera de la transacción; cambios de turno tampoco usan comparación atómica de estado. | Reprogramar conserva identidad y cupo; un cierre evita reservas; cancelar/atender simultáneamente no genera estados incompatibles; vencimiento libera el contexto correcto. |
| R12 / P2 | **Listas y errores confiables.** Padrón limita 300 filas, API 200, reservas 40 sin paginación. `PickupActions` no comprueba `res.ok`; la previa de dispensario tampoco valida el cuerpo HTTP antes de tratarlo como `Status`. | Buscar registros fuera de la primera página funciona; total distinto de filas visibles; error con acción de reintento sin aparentar éxito ni perder contexto. |

## Diseño propuesto del recorrido

1. **Hoy:** próximos turnos, reservas a preparar, documentos por resolver y alertas de lotes. Cada tarjeta abre su lista filtrada.
2. **Atender:** abrir una reserva identificada o buscar socio. Encabezado persistente con nombre/legajo; gramos reservados y turno visibles.
3. **Revisar:** elegibilidad común, lote, gramos reales y explicación de cualquier diferencia. Controles con estado pendiente, no verde por ausencia de dato.
4. **Registrar:** confirmación con contexto explícito e idempotencia; entrega, movimiento y vínculo de reserva atómicos.
5. **Comprobante:** ID y resumen verificable, acceso a historial y acción clara “Atender otro socio”.
6. **Cerrar jornada:** revisar diferencias, anulaciones y pendientes; exportar un período definido.

Métrica propuesta (aún no medida): tiempo desde abrir reserva a comprobante, porcentaje de retiros con vínculo correcto, errores/reintentos por entrega y pendientes al cierre. Medir con operadores de un club; no asignar porcentajes de mejora sin baseline.

## Orden de implementación para Hermes

- **Lote A — coherencia:** R01, R02, R03 y R06. Reglas y estados, escenarios unitarios + pruebas transaccionales. No dar por cerrada la seguridad del dominio por los 48 tests previos: cubrían otro alcance.
- **Lote B — operación integrada:** R04, R07 y R11. Solicitud vs compromiso de stock, contexto de atención, idempotencia y calendario. Requiere decisiones explícitas sobre reserva parcial, vencimiento y documentación obligatoria.
- **Lote C — administración:** R05, R08, R09, R10 y R12. Períodos de reportes, bandejas, cuarentena, auditoría y paginación. La corrección mínima de R05 puede adelantarse a A para no seguir etiquetando como anual el acumulado.

No priorizar ahora un chatbot, red social, ranking, predicción con IA, NFC ni un POS. El portal ya existe; no abrir otro proyecto para duplicarlo. Aportes/cuotas requieren su propio alcance y reglas.

## Evidencia ejecutada

Casos sintéticos con fecha fija `2026-10-24T15:00:00Z`, tope diario 25 g, mensual 50 g, menores de 21: 30 g/mes y THC máximo 10 %. Se importó la función del repo y se ejecutó con Node; no es una reimplementación.

| Caso | Salida real | Alcance |
|---|---|---|
| Socio 19 años, THC null, 5 g | `OK`, dayAfter 5 | Reproducción de aceptación con THC desconocido |
| VIGENTE, vencimiento null, THC 5 %, 5 g | `OK`, dayAfter 5 | Reproducción de aceptación con fecha faltante |
| Vence 24/10, atención 24/10 15:00Z | `REPROCANN_EXPIRED` | Comparación por instante, no define cuál debería ser la política |
| Adulto, uso diario -5, solicita 30 g | `OK`, dayAfter 25 | Motor puro acepta uso negativo; origen por reversa deducido de SQL, no probado en DB |

Los demás hallazgos se basan en lectura de código, con escenarios de aceptación propuestos. No se ejecutó un nuevo test de integración ni se probó carga, concurrencia de reservas o producción en esta sesión.
