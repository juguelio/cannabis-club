# Portal del socio: revisión informativa

Fecha: 25/10/2026. Base revisada: `4a0eb98`.

El repo ya incluye la integración del diseño de Cowork y el historial/documentación del portal. Esta revisión conserva ese diseño y agrega:

- Encabezado y enlaces internos a carnet, historial y documentación.
- Carnet con controles accesibles y distribución adaptable a pantallas pequeñas.
- Filtro de registros recientes: todos, sin anular o anulados; contador y estado vacío.
- Estado de ficha y documentación con textos diferenciados: sin documentación, en trámite, rechazado, vencido y vigente.
- Aviso de vencimiento próximo (30 días), vencimiento hoy o fecha faltante. Es presentación del registro existente, no una modificación de las reglas de habilitación.

Validación: 82 tests pasan (6 nuevos sobre estados documentales), TypeScript sin errores, lint sin errores y `git diff --check` limpio. Build con `npm run build -- --webpack` correcto. El intento con Turbopack se detuvo tras quedar sin progreso; no se confirmó su resultado. No se realizó nueva verificación visual: el acceso del navegador local quedó bloqueado en la sesión. No se publicó ni se modificó la base de datos.

Hallazgo pendiente del código existente: el calendario del portal no consulta `ClosedDay`, aunque el servicio de reservas sí lo hace. Esta revisión se limita al área informativa y no modifica reservas o entregas.


Actualización posterior (25/10/2026, investigación Codex sobre `7b04c2c`): `9b1ff6c` integró días cerrados en la página y API del portal. El hallazgo anterior describe el estado previo, no una integración todavía ausente. Ver `docs/republica-ong-reporte-codex-2026-10-25.md`.
