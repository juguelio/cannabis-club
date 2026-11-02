# República ONG: encaje de la app y prioridades

Investigación independiente de Codex · 25/10/2026 · para comparar con el trabajo de Hermes.

## Conclusión

Conviene conservar la base administrativa y completar la experiencia de socio alrededor de identidad, documentación, privacidad, ayuda y vínculo con la organización. El salto pendiente no es otra renovación visual completa: es que la persona entienda qué información tiene República sobre ella, qué necesita revisar y dónde pedir ayuda.

La app ya avanzó mucho respecto del diagnóstico anterior. No propongo reconstruir funciones existentes ni doy por implementadas las recomendaciones de este informe. El alcance de las propuestas es institucional, informativo y de protección de datos; no se desarrolla un plan de comercialización, reservas, producción o distribución de cannabis.

## Qué investigué y qué no

- Repo local en `7b04c2c`, más cambios sin commit de identidad República: nombre corto, logo, iconos, login, shell, configuración y portal. Conservados intactos.
- Código de autenticación, portal, avisos, consentimientos, esquema Prisma, rutas disponibles y documentación de privacidad.
- Fuentes públicas indicadas abajo. No consulté el informe paralelo de Hermes para mantener independiente esta lectura.
- Ejecuté `npm test`: **130 tests, 14 archivos, todos pasan**. No hice nuevas pruebas HTTP autenticadas, migraciones, build ni auditoría integral de seguridad.
- No hice una nueva revisión visual de la app: el acceso del navegador local había quedado bloqueado en la sesión. Las observaciones de diseño se basan en componentes, textos y estilos, no en capturas actuales.
- No revalidé producción. Los despliegues y verificaciones anteriores que registra Obsidian son evidencia histórica atribuida a sus autores, no pruebas ejecutadas en esta investigación.

## Identidad y contexto público

| Evidencia | Qué permite afirmar | Límite |
|---|---|---|
| El usuario identifica `@republica.ong` como la ONG de la app | Es la identidad de referencia para este encargo | No sustituye datos legales o un manual de marca |
| [Perfil indicado de Instagram](https://www.instagram.com/republica.ong/) | URL proporcionada por el usuario | La consulta directa falló; no verifiqué biografía, publicaciones, seguidores, enlaces ni estética del feed |
| [Entrevista de El Argentino, 12/03/2024](https://elargentinodiario.com.ar/entrevista/12/03/2024/exclusivo-cannabis-una-alternativa-contra-el-dolor/) | Presenta a República Cannabis Club, a Nicolás Quilaleo como presidente y describe un vínculo con profesionales de salud | Contexto histórico. No confirma cargos ni equipo médico actual; no tomo sus afirmaciones médicas o normativas como guía |
| [Nota de Cannábica Argentina, 26/08/2026](https://cannabicaargentina.com/2026/08/26/una-ong-realizo-el-primer-traslado-aereo-autorizado-de-cannabis-medicinal/) | Vincula explícitamente a República con el mismo Instagram y relata actividad entre Buenos Aires y Patagonia | Reporte periodístico de un episodio. No acredita sedes permanentes, cobertura actual ni habilitaciones vigentes |

**Inferencia de producto:** una identidad centrada en personas, acompañamiento y confianza encaja mejor con ese contexto público que una entrada dominada por el registro de gramos. La ONG debe validar este posicionamiento antes de convertirlo en texto institucional.

No se encontró un sitio institucional propio verificable en las búsquedas realizadas. Eso es una limitación de esta búsqueda, no prueba de que no exista.

## Lo que ya tenemos y sirve

| Área | Evidencia en el repo | Valor y límite |
|---|---|---|
| Identidad visual | `src/app/globals.css`, `src/components/shell.tsx`; logo e iconos locales en curso | Conservar tipografías, componentes y adaptación móvil. Falta aceptación visual de la marca real |
| Accesos separados | `src/lib/auth.ts`, `src/proxy.ts` | Roles ADMIN, OPERADOR y SOCIO; el portal usa la ficha asociada a la sesión. No equivale a auditoría exhaustiva de permisos |
| Legajo | `Member`, páginas de socios y acceso administrado | Ya hay identidad, estado, contacto y documentación; evitar otro padrón paralelo |
| Portal | `src/app/portal/page.tsx`, `src/components/member-portal.tsx` | Carnet, historial reciente, documentación, avisos y resumen de cuenta existentes |
| Privacidad | `src/lib/privacy.ts`, `Consent`, migraciones de documento | HMAC y últimos cuatro caracteres reducen exposición del número; cuatro finalidades y revocación registrada |
| Comunicación administrativa | `src/lib/notices.ts`, `/avisos`, `NoticeLog` | Cola y registro de avisos; WhatsApp preparado y envío manual. No hay confirmación técnica de entrega |
| Control interno | Rutas de auditoría, cierre mensual, inspección y reportes | Base reutilizable de trazabilidad. Un registro con huella no prueba por sí solo validez jurídica o firma digital certificada |
| Calidad y alertas | `src/lib/batch-quality.ts`, alerta de recall en portal | Existe información de seguridad para el socio; no hace falta inventar un segundo canal de alertas |

También hay cuenta corriente y otros módulos operativos incorporados después de `4a0eb98`. Se inventarían faltantes si se trabajara sólo con el reporte anterior.

**Corrección del diagnóstico previo:** `9b1ff6c` incorporó la consulta de días cerrados al portal; hoy `page.tsx` y `/api/portal/slots` usan `closedDayKeys`/`nextOpenDays`. No repetir como ausente esa integración. Esta constatación de código no certifica todos los casos del calendario.

## Hallazgos prioritarios

### 1. El consentimiento visible al socio quedó detrás del modelo nuevo — prioridad alta

El portal consulta y muestra `consentSignedAt`; administración registra DATOS_PERSONALES, SALUD, IMAGEN y COMUNICACIONES en `Consent`. El socio puede ver “firmado” sin conocer qué finalidad está autorizada, qué versión aceptó o si una autorización fue revocada.

**Propuesta:** una sección “Privacidad y permisos” que muestre cada finalidad, versión, fecha, estado y un canal de solicitud de revisión/revocación. El texto efectivo debe estar asociado a cada versión; guardar sólo `2026-10` no permite leer qué se aceptó.

**Aceptación:** revocar IMAGEN no cambia el estado de SALUD; el portal refleja las cuatro finalidades de esa persona; no se presentan finalidades no otorgadas como autorizadas.

### 2. La clave “temporal” no tiene ciclo temporal completo — prioridad alta

`/api/members/[id]/access` genera o restablece una contraseña. En el modelo `User` y las rutas revisadas no encontré expiración de esa clave, obligación de cambiarla ni cambio de contraseña propio del socio. Los JWT duran ocho horas y `getAnySession` revalida usuario activo, pero no compara una versión de credenciales: restablecer contraseña no invalida por sí solo un token anterior aún vigente.

**Propuesta:** activación inicial con vencimiento, cambio de contraseña, recuperación asistida claramente explicada y revocación de sesiones al restablecer acceso. Mantener mensajes que no revelen si existe una cuenta.

**Aceptación:** una credencial inicial vencida no permite entrar; después de restablecer acceso, la sesión anterior queda invalidada; el socio sabe a quién recurrir si perdió el acceso. Confirmar con pruebas de integración antes de darlo por resuelto.

### 3. Avisos con estados documentales imprecisos — prioridad alta

`memberNotices` clasifica cualquier estado distinto de VIGENTE como `REPROCANN_VENCIDO`; el mensaje dice que está vencido incluso para EN_TRAMITE, NO_APORTA o RECHAZADO. El portal ya dispone de una presentación más precisa en `member-document-status.ts`.

**Propuesta:** coherencia terminológica entre ficha, portal y comunicaciones documentales. Mostrar el dato conocido y la acción administrativa pendiente sin inventar un vencimiento.

**Aceptación:** una ficha EN_TRAMITE nunca genera una afirmación de documento vencido; una fecha ausente se describe como dato faltante.

### 4. Comunicación registrada no equivale a comunicación entregada — prioridad alta

`NoticeActions` permite abrir WhatsApp y registrar un aviso por separado. El registro usa `sentAt` y auditoría `NOTICE_SENT`, pero no hay evidencia de entrega del proveedor. Además, el último aviso se agrupa por socio y motivo sin distinguir episodios: una notificación antigua puede seguir contando cuando surge un nuevo problema del mismo tipo.

**Propuesta:** describirlo como declaración del operador, separar preparación/envío declarado/respuesta y distinguir cada episodio documental. Revisar la preferencia de canal y el consentimiento de comunicaciones antes de ampliar el sistema; la consulta actual carga finalidades, pero no las usa para decidir si presenta un enlace de WhatsApp.

**Aceptación:** abrir un enlace no prueba envío; una situación nueva no queda oculta bajo un aviso histórico; el registro muestra qué se sabe realmente. No automatizar mensajes sensibles como atajo.

### 5. Falta una puerta clara de ayuda e identidad institucional — prioridad media

El login conserva “Cada gramo, con nombre y fecha”, orientado al equipo interno. En las rutas revisadas no aparece ayuda al socio, página institucional ni recuperación de acceso. La lista de rutas públicas está restringida a login, autenticación, salud técnica y ficha de lote.

**Propuesta:** entrada “República · espacio de socios”, explicación breve de su uso, ayuda para acceder, contacto oficial confirmado y aviso de privacidad legible. En el portal: inicio, carnet, documentación, historial y ayuda. La interfaz del equipo puede conservar su lenguaje operativo.

**Aceptación:** una persona nueva distingue dónde ingresar y dónde pedir ayuda en menos de un minuto. No publicar teléfonos, domicilios o responsables deducidos de noticias antiguas.

### 6. La promesa documental necesita precisión — prioridad alta antes de datos reales

`docs/privacidad.md` afirma conservación de libros por cinco años y usa una formulación absoluta sobre la seguridad de las huellas. Esta investigación no acreditó el fundamento aplicable a cada categoría de información. HMAC reduce exposición, pero no convierte un padrón nominativo en anónimo ni elimina los riesgos de compromiso de claves y base de datos.

**Propuesta:** matriz de datos/finalidad/acceso/retención aprobada por la organización, plan de respaldo y recuperación de claves, y lenguaje documental que distinga pérdida de acceso de filtración. Validar períodos y obligaciones con asesoramiento competente; no trasladar automáticamente reglas de otras jurisdicciones.

**Aceptación:** cada período tiene responsable y fundamento; se ensaya restauración; las promesas de privacidad coinciden con el comportamiento comprobado.

### 7. El acompañamiento profesional requiere un espacio separado — prioridad posterior

La entrevista histórica menciona profesionales de salud. En el código revisado hay un nombre de Director Médico en configuración, pero los roles siguen siendo ADMIN/OPERADOR/SOCIO; no encontré un módulo clínico separado. El campo libre `Member.notes` no debe convertirse por defecto en historia clínica compartida.

**Propuesta:** primero confirmar si República realmente necesita seguimiento clínico dentro de esta app. Mientras tanto, ofrecer orientación y contacto profesional verificados, sin recolectar diagnósticos adicionales. Si se aprueba esa función, definir permisos clínicos, acceso mínimo y registro de accesos antes de formularios.

**Aceptación:** operación administrativa no ve notas clínicas por defecto; el contacto profesional está confirmado; no se promete atención de urgencias ni se ofrecen recomendaciones automáticas de tratamiento.

## Diseño: qué conservar y qué revisar

Conservar la paleta pino/niebla, la tipografía y el sistema de paneles existente; aplicar el logo oficial una vez validado, sin redibujar la marca basándose en una búsqueda incompleta. El nombre corto en curso evita encabezados desbordados.

Orden sugerido para información del socio: saludo e identidad → pendientes documentales relevantes → carnet → documentación y privacidad → historial → ayuda. Evitar dos banners para el mismo vencimiento, mostrar fecha concreta además de “en N días” y no depender sólo del color para distinguir estados.

QA pendiente: 360/390/768/1360 px, zoom 200 %, teclado, foco visible, lector de pantalla, nombres largos, historial vacío, permisos revocados, cuenta sin acceso y conexión fallida. Son criterios a ejecutar, no resultados ya obtenidos.

## Orden de trabajo sugerido

1. **Alinear la identidad y los datos reales:** nombre institucional, nombre público, responsable de contenidos, contacto, destinatarios de la app y manual/activos de marca. Separar demo y producción; Obsidian registra riesgo histórico de Preview apuntando a la misma base, que requiere nueva verificación.
2. **Cerrar acceso y privacidad:** ciclo de credenciales, sesiones, consentimientos visibles y textos versionados. Revisar exposición de datos antes de incorporar fichas reales.
3. **Completar experiencia informativa:** ayuda, lenguaje coherente y comunicaciones documentales fieles al estado. Probar con personal de secretaría y socios usando datos ficticios.
4. **Sólo después, decidir extensiones:** orientación profesional, biblioteca educativa o actividades institucionales. No sumarlas únicamente porque aparezcan en un benchmark.

No asigno fechas cerradas: faltan responsables, disponibilidad y aceptación de alcance. El primer lote debería ser pequeño y demostrable, no otra lista de decenas de funciones.

## Qué pedirle a República y contrastar con Hermes

- ¿Cuál es el nombre legal y cuál el nombre que quieren mostrar? ¿Qué datos pueden publicarse?
- ¿Quién mantiene los contenidos y atiende problemas de acceso? ¿Qué canal y horario son reales?
- ¿Cuáles son los tres problemas más frecuentes de socios y secretaría hoy?
- ¿Qué equipo profesional está vigente y qué información necesita realmente esta app?
- ¿Qué textos de privacidad y consentimiento están aprobados, y dónde se conserva cada versión?
- ¿Trabajan con una única oficina administrativa o varias? La noticia de un viaje no demuestra una estructura de sedes.
- ¿Qué evidencia obtuvo Hermes directamente del Instagram que aquí no fue accesible? Priorizar esa evidencia para validar marca y comunicación, manteniendo separados hechos y propuestas.

Próximo paso concreto: revisar estos hallazgos con la persona que administra el padrón y dos socios; elegir un flujo informativo para probar de punta a punta con datos ficticios. Este reporte no autoriza publicación, contacto externo ni cambios de base.


Cierre de la revisión: mientras se redactaba este informe, el trabajo paralelo de marca quedó registrado en `282c20a` (nuevo HEAD local). La base analizada fue `7b04c2c` más esos cambios presentes en el árbol de trabajo. No se infiere despliegue a partir de ese commit.
