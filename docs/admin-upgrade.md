# Gestión del club — mejora del 24/10/2026

## Entregado en código local

- Panel con accesos rápidos, jerarquía tipográfica y superficies consistentes; navegación accesible y móvil con todas las secciones.
- Configuración del club para ADMIN: identidad, responsables, REPROCANN, topes y edades. Validación conjunta de reglas y auditoría atómica.
- Editor de contacto, REPROCANN y consentimiento desde el legajo del socio.
- Estados de carga/error, mensajes de formulario con contraste y correcciones de layout en login, stock, dispensario, turnos y reportes.
- KPI de socios a regularizar sin el truncamiento de cuatro registros; aviso de configuración condicionado a los datos reales.
- Sesiones verificadas contra la cuenta actual: desactivación y cambio de rol aplican inmediatamente. La consola admite ADMIN/OPERADOR; no implementa portal SOCIO.
- Respuestas de fichas y entregas ya no serializan el passwordHash del operador.
- Cosecha, movimientos, altas y anulaciones usan transacciones Serializable. Cosecha y movimientos guardan su auditoría en la misma transacción. Conflictos devuelven 409 con mensaje accionable, sin reintento silencioso.
- Validación de fechas reales y precisión de gramos; errores conocidos de Prisma y JSON malformado tienen respuesta controlada.

## Evidencia

- 48 tests unitarios PASS; TypeScript y ESLint PASS.
- 20 comprobaciones HTTP/DB PASS: autenticación, permisos, configuración, legajo, privacidad, cuenta desactivada; dos cosechas simultáneas, dos ajustes negativos y dos anulaciones: una operación válida y una rechazada por par.
- Build de producción PASS. El primer intento conservaba un error de sandbox en la caché de Turbopack; compilar con caché limpia resolvió el fallo.
- Navegador real: login, panel, configuración guardada con confirmación; revisión a 1280 px y 390 px. Panel, socios, stock, dispensario, turnos, reportes y configuración sin overflow horizontal a 390 px.
- Captura local: `.shots/panel-upgrade.png` (ignorada por Git).

## Reproducir la integración

Estas pruebas modifican datos ficticios y requieren un seed nuevo. Usan una base separada, nunca la base habitual de desarrollo ni producción.

```bash
PGDATA_DIR=/tmp/cannabis-club-review-pg PGPORT_LOCAL=55434 bash scripts/dev-db.sh start
DATABASE_URL=postgresql://altostake@127.0.0.1:55434/cannabis_club_dev npx prisma migrate deploy
DATABASE_URL=postgresql://altostake@127.0.0.1:55434/cannabis_club_dev npm run db:seed
DATABASE_URL=postgresql://altostake@127.0.0.1:55434/cannabis_club_dev npx next dev -p 3301
# En otra terminal:
DATABASE_URL=postgresql://altostake@127.0.0.1:55434/cannabis_club_dev node scripts/smoke-admin.mjs
```

## Límites

Cambios sin publicar, sin migraciones nuevas. Producción no se modificó ni revalidó. No es una auditoría exhaustiva del backend: quedan fuera portal de socios, cuotas, importación, retención automatizada, idempotencia de entregas y validación con un club real. El campo capacidad de socios conserva su semántica actual de configuración; no se agregó una regla de bloqueo de altas.
