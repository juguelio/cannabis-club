# Alta de socios: onboarding con documentación

## El recorrido

1. **Google** (`/login`) identifica a la persona. Si el email no está en el padrón, se crea una cuenta **SOCIO
   inactiva, sin legajo** y se abre una **sesión de onboarding** (`cc_solicitud`, 4 h).
2. **`/solicitud`** — la persona completa sus datos (identidad, nacimiento, teléfono, domicilio, REPROCANN con
   vencimiento, tipo de consumo) y acepta la declaración jurada.
3. **Documentación** — sube DNI frente, DNI dorso y credencial REPROCANN. Se cifran antes de tocar la base.
4. **Revisión** — la persona ve «el club va a chequear tu documentación». El club la revisa en
   **Configuración › Solicitudes de alta**.
5. **Aprobación** — un ADMIN crea el legajo (legajo siguiente, estado `ACTIVO`, REPROCANN `VIGENTE`, fecha de
   consentimiento = la de la solicitud), vincula la cuenta y la habilita. La próxima vez que entre con Google cae
   directo en `/portal`.

Rechazo: exige un motivo de al menos 10 caracteres que la persona lee en su pantalla; puede corregir y volver a
presentar la misma solicitud (pasa a `PENDIENTE` de nuevo, conservando los archivos que ya subió).

## Por qué una cookie aparte

La sesión de onboarding **no es** `cc_session`: con `cc_solicitud` sólo se llega a `/solicitud` y a `/api/solicitud*`.
Así una cuenta sin aprobar no puede ni asomarse a la consola ni al portal, y no hay que relajar el guard de roles.
Después de la aprobación, esa cookie deja de servir: el portal exige la sesión normal.

## Revisar sin adivinar

- Las altas viven en **Socios › Altas** (solapa con el número de pendientes). El panel muestra los tres documentos como **miniaturas** (DNI frente, dorso y REPROCANN) con su
  peso; al hacer clic se abren en una pestaña. Las que faltan aparecen con borde punteado y el texto «Falta…».
- El servido es **`GET /api/solicitudes/[id]/documentos/[docId]`**, sólo ADMIN: descifra en memoria, responde con
  `Content-Type` real, `Cache-Control: no-store` y CSP `sandbox`. **Cada apertura queda en auditoría** (`ACCESS_DOC_VIEW`,
  con quién, de quién y qué tipo).
- Sin sesión de staff la ruta responde **401** y con rol OPERADOR **403**: el legajo no se abre desde un enlace público.
- Del lado de la persona, la pantalla de solicitud muestra el estado de cada archivo con su peso y un botón
  **«Reemplazar archivo»** mientras la solicitud está en revisión; si sube uno nuevo, se reemplaza el anterior del mismo
  tipo (no se acumulan).

## Archivos y cifrado

- `AccessDocument.data` es **ciphertext AES-256-GCM**; `iv` y `tag` van en columnas propias. La base no guarda la
  imagen en claro: si alguien hace un dump, no obtiene documentos.
- Clave: `DOC_ENC_KEY` (32 bytes en base64) en el entorno. Local en `~/.config/cannabis-club-doc-enc-key` (600).
  **Si la clave se pierde, los archivos no se recuperan**: no se rota sin un plan de re-cifrado.
- Límites: 6 MB por archivo, sólo JPG/PNG/WEBP/PDF. Se guarda `sha256` para poder verificar integridad.
- **Cada apertura de un documento queda en `AuditLog`** (`ACCESS_DOC_VIEW`), con quién lo abrió y de quién era.
  El dueño del expediente puede ver el suyo sin auditoría (es su documento).
- El número de DNI **no se guarda en claro**: se guarda `docHash` (HMAC) + `docLast4`, y el número completo cifrado
  sólo para poder crear el legajo en la aprobación.

## Reglas que no se negocian

- **Presentar la solicitud no crea socio**: el socio lo crea la aprobación, y la aprobación exige los tres archivos.
- **Un documento ya registrado no se puede presentar dos veces** (`DOCUMENTO_YA_REGISTRADO`): el `docHash` es único
  contra el padrón, así alguien no pide dos legajos con el mismo DNI.
- **No se aprueba dos veces** ni se rechaza una aprobada.
- **La solicitud no toca el libro**: ni stock, ni dispensaciones, ni cuenta corriente.
- El club sigue siendo el que decide: el sistema valida que el expediente esté completo, no que la persona merezca
  el alta.

## Retención (30 días)

`POST /api/mantenimiento/retencion` (sólo ADMIN) borra los archivos de las solicitudes **rechazadas** hace más de
30 días, deja la solicitud con su motivo y registra `ACCESS_DOC_RETENTION` con el detalle. Los archivos de un socio
aprobado **no se tocan**: son su legajo. Pensado para un cron diario; a mano también sirve.

## Avisos por email

Al aprobar y al rechazar se manda un mail (`src/lib/mailer.ts`, API HTTP de Resend, sin SDK):

- **Aprobado**: legajo, y el link de ingreso con Google.
- **Rechazado**: el motivo tal cual lo escribió el club y cómo volver a presentar.

Si faltan `RESEND_API_KEY` y `CLUB_MAIL_FROM`, **no se manda nada y el alta funciona igual**: el asiento
`ACCESS_APPROVED_NOTICE` / `ACCESS_REJECTED_NOTICE` queda con `enviado: false` y el motivo. Nunca se inventa un
remitente: el dominio tiene que estar verificado en Resend.

Pasos para activarlo: crear cuenta en Resend → verificar el dominio del club (registros DNS) → cargar
`RESEND_API_KEY` y `CLUB_MAIL_FROM` (por ejemplo `República ONG <no-reply@dominio-del-club>`).

## Pendiente

- **Firma digital de la DDJJ**: hoy es un checkbox con versión de texto (`AFFIDAVIT_VERSION`).
- **Cron de retención**: la ruta existe; falta agendarla (Vercel Cron o launchd).
