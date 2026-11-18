# Revisión de código antes de producción — 30/10/2026

## Resultado

Corregidos problemas de acceso, aislamiento de entornos y compilación. **No equivale a habilitación de producción**: falta una prueba de integración con base disponible y comprobar configuración/servicios reales. No hubo despliegue, cambios de variables, migraciones, limpieza de datos ni envío de mensajes.

Base inicial: `65c472c`. Durante la revisión entraron cambios paralelos de datos legales (`ad748a0`, `c961c46`), preservados. Las modificaciones de Codex están en el árbol de trabajo, sin commit. Los cambios previos de `docs/portal-informativo-2026-10-25.md` y el informe República del 25/10 ya estaban al comenzar.

## Errores corregidos

| Hallazgo | Corrección | Evidencia |
|---|---|---|
| Reset de contraseña del equipo no revocaba sesiones | Incrementa `tokenVersion`; también al cambiar rol o activar/desactivar una cuenta | Pruebas de las rutas de usuarios con persistencia simulada y de JWT frente al estado del usuario |
| Alta/reset del equipo no exigía cambio de clave, pese a la documentación | Clave temporal con fecha, pantalla `/cuenta/clave`, bloqueo de APIs hasta reemplazarla | Pruebas de creación/reset y guardas de ADMIN/SOCIO; se conserva la gestión de clave propia y logout |
| No todas las páginas internas revalidaban la sesión contra la base | Layout común de staff consulta usuario activo y versión de token; redirige si debe cambiar clave | Lectura del árbol de rutas, TypeScript y build; pendiente prueba de navegador autenticada |
| Un cambio de clave podía pisar un reset concurrente | Actualización condicionada por versión, hash y estado activo; auditoría en la misma transacción; sesión nueva sólo después del commit | Pruebas de rechazo 401/409 y orden de auditoría/emisión; no es una prueba de concurrencia real contra Postgres |
| Preview bloqueaba POST pero dejaba pasar GET que escribe, como OAuth | Bloqueo de rutas de app en entorno compartido para todos los métodos; sin huella configurada responde 503; health queda accesible | Pruebas de GET/HEAD/POST, falta de configuración y base separada |
| Host directo y pooler Neon podían eludir comparación de bases | Reconoce ambos alias del mismo endpoint, conservando las huellas existentes | Regresión con huella directa/pooler y base distinta |
| Inspección permitía OPERADOR aunque la matriz dice sólo ADMIN | Matriz y página exigen administración | Regresión de permisos y menú |
| Build rechazaba export `MODE` en una página | Constante queda interna; sin cambio de lógica de negocio | Primer build falló con TS2344; segundo build con Webpack terminó correctamente |

Las correcciones se limitan a infraestructura, acceso y privacidad. No se modificaron reglas operativas de producción, reservas o entregas.

## Validación ejecutada

- Baseline: 242 tests pasan; lint sin errores.
- Resultado final: **266 tests en 30 archivos**, todos pasan. 22 casos nuevos corresponden a esta revisión; dos casos adicionales de datos legales llegaron con el trabajo paralelo.
- `npm run lint`: correcto.
- `npx tsc --noEmit`: correcto tras los cambios finales.
- `git diff --check`: correcto.
- `npm run build -- --webpack`: terminó con código 0 después de corregir el export. Emitió advertencias del lockfile externo y errores de conexión al Postgres local `127.0.0.1:55433` durante lecturas de prerender; la app maneja esos errores y el proceso completó. **Build correcto no significa conexión a base correcta.** El último ajuste de permisos de Inspección se verificó después con tests/lint/TypeScript.
- No se ejecutó build con Turbopack en esta revisión, ni smoke autenticado, OAuth real, migraciones, restauración o QA visual.
- Las pruebas nuevas de endpoints usan las rutas reales con base/autenticación simuladas. Las pruebas de sesión verifican JWT reales con clave de prueba y usuario simulado. No certifican integración productiva.

## Antes de publicar estos cambios

1. Configurar/verificar `PROD_DB_FINGERPRINT` **en Preview/Development**, no sólo en Production. El cambio es deliberadamente restrictivo: sin ella el preview responderá 503 salvo health. Comparar health de ambos entornos; la barrera web no protege scripts ni conexiones directas. Local sin `VERCEL_ENV` queda fuera de esa barrera.
2. En una base aislada, probar creación de usuario → clave temporal → cambio → login → reset desde otra sesión → rechazo del token viejo. Probar también cambio de rol, desactivación y reactivación; verificar Inspección sólo ADMIN.
3. Probar dos cambios de contraseña simultáneos y un reset concurrente contra Postgres; sólo un cambio compatible con la versión debe prosperar. Comprobar auditoría y ausencia de contraseñas en registros.
4. Comprobar la configuración vigente que enumera `docs/paso-a-produccion.md`: cuentas reales, datos institucionales, remitente/dominio, correo, retención y respaldo. Ese documento es evidencia del 29/10; aquí no se consultó la base productiva para confirmar su estado actual. `docs/dominio-y-emails.md` fue incorporado por el trabajo paralelo durante esta revisión.
5. Ensayar restauración y retención en datos ficticios. La existencia de un script o un backup manual no prueba que haya una tarea programada ni una recuperación utilizable.

No se puede dar por cerrado el lanzamiento sólo porque pasen tests unitarios. Tampoco se proponen nuevas pantallas de negocio como condición para cerrar este lote de seguridad.

## Idea nueva para Obsidian — propuesta, no implementada

**Panel “Preparación del entorno” exclusivo de ADMIN**, extendiendo los primeros pasos existentes, sin duplicarlos. Debe separar “configurado”, “probado” y “pendiente”, mostrando fecha y responsable de la última prueba.

Indicadores útiles: identidad del entorno/base sin secretos; cuentas demo activas; configuración de remitente; última prueba de correo; última retención completada; último respaldo y última restauración comprobada. Una variable presente nunca debe mostrarse como “servicio probado”. No publicar estos indicadores en `/api/health`.

Criterio de aceptación: cada estado verde tiene evidencia fechada y alcance; una prueba vieja se marca pendiente de revalidación; no ofrece botones de borrado o envío automático. El panel sólo observa y ayuda a revisar. Antes de construirlo, validar con Hermes si el checklist existente puede cubrirlo con menos código.

## Entrega y reversión

Fuentes de contexto: canon de Obsidian, `docs/paso-a-produccion.md`, `docs/roles-y-accesos.md`, `docs/entornos.md`, código actual y guías locales Next para rutas/layouts. No se alteró contenido de otras investigaciones.

La revisión no requiere migración de esquema. Para revertir, retirar sólo los hunks y archivos de este lote después de revisar el diff; no ejecutar un reset global porque hay trabajo paralelo y documentos anteriores sin commit. No se ofrece como reversión recomendada volver a aceptar sesiones anteriores a un reset.
