# Roles y accesos

La matriz vive en `src/lib/roles.ts`. El menú (`shell.tsx`) filtra con `permite()` y el proxy corta la ruta antes de
renderizar; los endpoints repiten el control con `requireUser([...])`, porque una regla de UI no es una regla de seguridad.

| | ADMIN | OPERADOR | DISPENSADOR |
|---|---|---|---|
| Panel, Dispensario, Turnos, Calendario | sí | sí | sí |
| Socios (padrón y legajo) | sí | sí | sí, sin cuenta corriente |
| Stock y lotes | sí | sí | sólo lectura |
| Avisos | sí | sí | sí |
| Traslados, Control | sí | sí | no |
| Libros y reportes | sí | sí | no |
| Cierre mensual, Informe semestral | sí | no | no |
| Modo inspección, Configuración | sí | no | no |

## DISPENSADOR (mostrador)

Carga la entrega en el dispensario: elige socio, lote y gramos; el sistema valida tope diario y mensual, REPROCANN
vigente y liberación del lote. Puede confirmar reservas de retiro y dar turnos.

**No puede**: aprobar altas ni abrir documentos del legajo, ver la cuenta corriente, anular entregas o contra-asientos,
crear o editar lotes y variedades, cargar traslados, abrir libros, cierres, informe semestral ni configuración.

Si abre una ruta que no le toca, el proxy lo devuelve al panel —no ve ni el esqueleto de la pantalla.

## Cuentas

Se crean desde Configuración › Equipo (sólo ADMIN). El club define el email institucional de cada persona; el alta manda
una clave provisoria y la persona la cambia al entrar (`mustChangePassword`).

## Datos legales

Configuración › **Datos legales** junta lo que sólo el club puede declarar: nombre legal, CUIT, personería, REPS,
domicilio legal, inscripción del club en el REPROCANN y responsables con matrícula y título (Res. 1780/2025).
Mientras falten, el panel muestra la tarjeta «Datos legales» con la cuenta y la pantalla lista cada campo pendiente.
