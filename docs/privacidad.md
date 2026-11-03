# Privacidad — inventario y límites verificados el 03/11/2026

Esta nota reemplaza el inventario anterior: la incorporación de altas, verificaciones y comprobantes hizo falsa la afirmación de que la aplicación no guarda el documento. Fuente: código local `c185484` y revisión en `codex/legales-privacidad-2026-11-03`. No verifica configuración productiva ni constituye un dictamen legal.

## Datos e implementación

| Categoría | Implementación observada | Límite |
|---|---|---|
| Padrón | `docHash` HMAC y `docLast4`; identidad, contacto, nacimiento, REPROCANN | Sigue siendo información personal identificable |
| Alta | `AccessRequest.docNumberCipher` y documentos cifrados | Se conserva el número completo, aunque no se muestre en la ficha ordinaria |
| Verificación del socio | `MemberVerification.docNumberCipher` y adjuntos cifrados | No cubierta por la purga de solicitudes de alta rechazadas |
| Comprobantes de transferencia | Archivos cifrados y metadatos; revisión por ADMIN/OPERADOR | Sin pasarela de pago ni borrado automático general |
| Consentimientos | Cuatro finalidades, versión y revocación por registro | Alta no captura aceptación independiente de cada finalidad |
| Auditoría | Actor, acción, fecha y, en ciertas rutas, IP | No afirmar que toda consulta, respaldo o acceso de infraestructura queda auditado por la app |

El cifrado de documentos es AES-256-GCM (`docs-crypto.ts`). El padrón y todos los metadatos no están cifrados con ese mecanismo. Las rutas autorizadas de apertura registran auditoría; esto no demuestra la custodia real de claves, controles de infraestructura ni seguridad absoluta.

`DOC_HASH_KEY` (con fallback a `AUTH_SECRET` y separación de dominio) permite comparar documentos exactos. Rotarla sin un procedimiento de migración invalida las comparaciones existentes. Las copias cifradas en expedientes no significan que exista una herramienta automática de reconstrucción de huellas. Conservar cifrado y huella no anonimiza el conjunto.

## Retención real y pendiente

`purgarDocumentosRechazadas` elimina únicamente `AccessDocument` de altas RECHAZADA cuya revisión superó 30 días, cuando corre la tarea. No elimina el expediente ni su `docNumberCipher`, verificaciones, comprobantes, libros o respaldos.

No existe borrado general por baja ni debe publicarse “5 años por ley” para todas las categorías. Se requiere matriz aprobada: finalidad, fundamento, plazo o criterio, responsable, ejecución y tratamiento de respaldos. Los expedientes pendientes abandonados y las verificaciones reemplazadas necesitan una regla propia.

La integridad del libro se mantiene por contra-asientos; no permite rechazar automáticamente cualquier rectificación o supresión de datos personales.

## Consentimientos y avisos

`CONSENT_VERSION=2026-10` y sus textos históricos se conservaron sin alteración. Cambiar la política no cambia las autorizaciones anteriores. La DDJJ de solicitud (`AFFIDAVIT_VERSION`) no debe presentarse como prueba de aceptación de cuatro finalidades ni de una versión concreta de T&C.

Pendientes de implementación/definición antes de afirmar cumplimiento:

- Evidencia expresa y separada para los tratamientos que la requieran, especialmente datos de salud; el artículo 7 de Ley 25.326 necesita análisis del encuadre de la ONG, no sólo un checkbox.
- Imagen institucional opcional, finalidad/canales/alcance y revocación; no convertir una copia del DNI en autorización de imagen.
- `avisos-auto.ts` no consulta consentimiento COMUNICACIONES. Definir fundamento y preferencias y hacer que el comportamiento coincida con lo informado; los mensajes pueden revelar REPROCANN.
- Captura de aceptación versionada de términos, si corresponde; no retroatribuir aceptación a los 22 legajos existentes.
- Circuito de derechos con constancia y plazos: acceso 10 días corridos; rectificación, actualización y supresión 5 días hábiles según procedencia.

## Proveedores y transferencias

Código e inventario del proyecto: Vercel (app), Neon (base), Resend (correo si configurado), Google (OAuth opcional), WhatsApp/Meta (canal externo). El transporte puede recibir los datos necesarios de despacho. Google/Meta también tienen tratamientos propios; no afirmar que todos actúan sólo por instrucciones del club.

Pendiente verificar con quien administra las cuentas: contratos, encargados, subencargados, países/regiones, garantías para transferencias, acceso del desarrollador, custodia de claves, incidentes y respaldos. No se verificó nada de eso accediendo a cuentas en esta revisión.

Cookies observadas: `cc_session` 8 h, `cc_solicitud` 4 h y `cc_oauth` 600 s. HttpOnly impide lectura por JavaScript, no por el navegador. No se encontró instrumentación de publicidad/analítica de visitas en el código revisado; revisar configuración de plataforma antes de afirmarlo globalmente.

## Publicación y control

Los textos de `/terminos` y `/privacidad` quedan como borradores revisados. Validar identidad/domicilio/contacto, estatuto, habilitaciones, reglas de devolución, transporte y tratamientos sensibles con la ONG y su asesor legal. No afirmar aprobación de la comisión sin evidencia.

La cláusula de revocación ya no termina el derecho por retirar: bajo el régimen aplicable de contratación a distancia, el artículo 34 cuenta desde entrega o celebración, lo último que ocurra. Las excepciones y el encuadre concreto requieren revisión jurídica; la palabra “aporte” no excluye por sí sola derechos.

Comparativa, fuentes públicas y decisiones pendientes: nota `01-Projects/cannabis-club/LEGALES-comparativa-Codex-2026-11-03.md` del vault de Obsidian.
