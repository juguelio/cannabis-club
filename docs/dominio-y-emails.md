# Dominio y emails del club

## Lo que necesito del club

1. **El dominio exacto** (ej. `republicaong.org.ar`).
2. **Los NS actuales** y quién administra el panel del registrador (para cambiar los NS o cargar registros).
3. **Qué casillas** quieren: propuesta mínima `admin@`, `dispensario@`, `hola@` (o `contacto@`).

## Camino recomendado: NS a Vercel DNS

El dominio queda administrado desde el mismo panel que el sitio. Vercel DNS sirve para el sitio **y** para el correo
(soporta MX, TXT y SPF/DKIM), así que no hace falta partir el DNS.

| Tipo | Nombre | Valor | Para qué |
|---|---|---|---|
| A | `@` | `76.76.21.21` | Sitio en el dominio raíz |
| CNAME | `www` | `cname.vercel-dns.com` | Alias `www` |
| MX | `@` | según proveedor de correo | Recibir emails |
| TXT | `@` | `v=spf1 include:… ~all` | SPF del proveedor |
| TXT | `resend._domainkey` | el que da Resend | DKIM para mandar avisos |

Después de cambiar los NS, Vercel emite el certificado solo (unos minutos). Con el dominio andando hay que:

- actualizar `APP_BASE_URL` en Vercel a `https://<dominio>`;
- agregar `https://<dominio>/api/auth/google/callback` en Google Cloud (cliente «Web - Republica ONG»);
- volver a probar el login con Google.

## Opciones de correo

| Opción | Costo | Sirve para | Contra |
|---|---|---|---|
| **Google Workspace** | ~USD 7 por casilla/mes | Casillas reales, Gmail, calendario compartido | Se paga por usuario |
| **Zoho Mail** | plan gratis de 1 casilla / ~USD 1 por casilla | Casillas reales con IMAP | Panel distinto, límites de envío |
| **Cloudflare Email Routing** | gratis | Recibir en `@dominio` y reenviar a un Gmail existente | No es una casilla: no se puede «enviar como» sin configurar SMTP |
| **Resend** | gratis hasta 3.000 emails/mes | **Enviar** los avisos de la app (alta, rechazo) | No recibe correo |

Lo que la app necesita sí o sí es **poder enviar** (Resend + dominio verificado, con `RESEND_API_KEY` y
`CLUB_MAIL_FROM`). Recibir correo en el dominio es una comodidad para el club, no un requisito técnico.

## Orden de trabajo

1. Llegan el dominio y los NS → los apunto a Vercel y verifico el certificado.
2. Se crea la casilla del administrador (según la opción elegida).
3. **Configuración › Equipo**: se crea la cuenta ADMIN con ese email y se apaga `admin@club.test`.
4. `APP_BASE_URL` + Google redirect + `CLUB_MAIL_FROM` y `RESEND_API_KEY`.
5. Prueba de aceptación con un socio ficticio y se borra.
