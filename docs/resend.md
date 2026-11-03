# Correo del club con Resend

Estado: **el código ya está listo y espera dos variables**. Mientras falten, el cron de avisos corre, deja el
asiento en la base y responde `mailer: false`: no inventa que envió.

## Qué falta, en orden

### 1. Dominio en Resend

1. Entrar a resend.com y agregar el dominio `republicacannabis.com.ar` (la cuenta puede ser la misma de
   Patagonia Sounds; el dominio se agrega aparte y tiene su propia clave DKIM).
2. Resend devuelve **tres registros DNS**. No son secretos: son públicos y hay que cargarlos en **Vercel DNS**
   (el dominio ya está delegado a `ns1/ns2.vercel-dns.com`). Resend los pide así, aunque los valores exactos salen
   de su panel:

| Tipo | Nombre | Valor |
|---|---|---|
| MX | `send` | `feedback-smtp.<region>.amazonses.com` prioridad 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey` | la clave DKIM que muestra el panel (única de la cuenta) |

3. Esperar a que Resend verifique. Con el DKIM y el SPF de `send.` en verde alcanza para mandar.

### 2. Variables en Vercel (producción)

| Variable | Valor | Para qué |
|---|---|---|
| `RESEND_API_KEY` | `re_...` (secreta) | autentica el envío |
| `CLUB_MAIL_FROM` | `República Cannabis <avisos@republicacannabis.com.ar>` | remitente técnico |
| `CLUB_MAIL_REPLY_TO` | `republicacannabisclub@gmail.com` | a dónde cae la respuesta del socio |

Después de cargarlas hay que **redeployar** (las variables se leen al arrancar la función).

### 3. Verificación real (no alcanza con que el DNS diga verde)

```bash
# el cron corre, deja el asiento y ahora tiene que decir mailer: true
curl -s -X POST https://republicacannabis.com.ar/api/avisos/vencimientos \
  -H "Authorization: Bearer $CRON_SECRET" | head -c 400
```

Y un envío de prueba real a una casilla propia antes de tocar a un socio: que llegue, que no caiga en spam y que
el remitente se vea como el club.

## Decisiones ya tomadas

- **Sin SDK**: `src/lib/mailer.ts` usa la API HTTP (`api.resend.com/emails`), una dependencia menos.
- **Texto plano**, sin plantilla HTML: el aviso es administrativo y tiene que leerse en cualquier cliente.
- **`reply_to` separado del `from`**: el remitente técnico no recibe respuestas.
- **Si falta configuración no se envía nada y se informa**: el alta y el rechazo funcionan igual.

## Pendiente de decisión del club

- **Dirección del remitente**: propuesta `avisos@republicacannabis.com.ar`. Alternativas: `club@`, `hola@`.
- **Buzón de respuesta**: hoy el contacto del sitio está vacío y el club usa `republicacannabisclub@gmail.com`.
  Cuando haya casilla propia en el dominio, se cambia sólo `CLUB_MAIL_REPLY_TO`.
- **Qué avisos se mandan**: hoy el cron de vencimientos. Alta aprobada y rechazo ya tienen texto escrito en
  `mailer.ts`; falta activarlos en las rutas de aprobación, y **filtrar por la finalidad COMUNICACIONES** antes de
  mandar nada (el correo revela el vínculo con el club).
- **DMARC**: conviene agregar `_dmarc` con `p=none` al empezar y endurecerlo después de ver los reportes.

## La casilla `info@`: Zoho UK no sirve para el plan gratis

Se creó la cuenta de Zoho con el mail de HAL y el panel abrió en **`mailadmin.zoho.uk`** (datacenter de UK/UE).
En ese DC **el plan gratuito no existe**: al terminar el alta del dominio el panel responde
`serviceDeniedError?type=paidOnlyDC` ("You currently have no active plan") y manda al checkout de
**Zoho Workplace · Mail Lite (~£9,60 por usuario al año)**. No es un bloqueo de configuración: es la política de
ese DC.

El plan gratuito (1 dominio, 5 usuarios, 5 GB por usuario, sólo web) sí existe en el **DC de Estados Unidos
(`zoho.com`)**. Camino elegido: **borrar la organización de UK y crearla en `zoho.com`** — con la misma cuenta de
Google, que en ese flujo pide passkey/OTP del teléfono.

Dos cosas para no repetir el error:

- **No cargar el dominio en `mailadmin.zoho.uk`**: se pierde el tiempo, siempre termina en checkout.
- **Un dominio no se puede tener en dos organizaciones a la vez**: primero borrar la de UK (queda vacía, no hay
  riesgo) y recién después agregarlo en la de US.

Cuando el dominio esté en el DC correcto, los registros a cargar en Vercel DNS son los de siempre: **MX en la raíz**
(`mx.zoho.com` 10 / `mx2.zoho.com` 20 / `mx3.zoho.com` 50), **SPF** `v=spf1 include:zoho.com ~all`, el **TXT de
verificación** de Zoho y la **DKIM** del selector `zoho`. No chocan con Resend, que usa `send` y `rsend`.
