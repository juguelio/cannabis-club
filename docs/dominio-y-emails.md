# Dominio y emails del club

## Estado del dominio (verificado 30-oct-2026)

- **Dominio**: `republicacannabis.com.ar`, registrado en **nic.ar** (creado 27-oct-2026).
- **Hoy no está delegado**: la consulta DNS devuelve `NXDOMAIN`, así que no tiene nameservers ni registros. No hay sitio,
  correo ni servicios colgados: **no hay nada que migrar ni riesgo de cortar el correo de nadie**.
- Ya está agregado al proyecto de Vercel `cannabis-club`, con el dominio raíz y `www`.

## Lo que tiene que hacer el club en nic.ar (5 minutos)

Ingresar con **CUIT/CUIL + Clave Fiscal** (nivel 3 para una asociación) → *Trámites a Distancia* → **NICar** → buscar
`republicacannabis.com.ar` → botón **Delegar** → **Agregar una nueva delegación** y cargar, uno por uno:

| # | Nameserver |
|---|---|
| 1 | `ns1.vercel-dns.com` |
| 2 | `ns2.vercel-dns.com` |

Guardar cada uno y después **Ejecutar cambios** (sin ese último paso no se aplica). nic.ar no tiene zona DNS propia: no
se pueden pegar registros A o MX, sólo nameservers. La delegación figura activa en el transcurso del día.

## Lo que hago yo después (en este orden)

1. Verificar la delegación con `vercel domains inspect` hasta ver *Valid Configuration*.
2. Crear los registros del correo (MX, SPF, DKIM) en Vercel DNS, según el proveedor elegido.
3. `APP_BASE_URL` → `https://republicacannabis.com.ar` y agregar el redirect nuevo en Google Cloud.
4. Crear la cuenta ADMIN con el email institucional y apagar `admin@club.test`.
5. Probar: sitio, login con Google, alta de un socio ficticio y después borrarlo.

## Opciones de correo (decisión del club: implica gasto)

| Opción | Costo | Sirve para | Ojo |
|---|---|---|---|
| **Zoho Mail** | gratis 1 casilla / ~USD 1 por casilla | Casilla real con IMAP | Panel aparte, límites de envío |
| **Google Workspace** | ~USD 7 por casilla/mes | Casilla real, Gmail, calendario | Se paga por usuario |
| **Cloudflare Email Routing** | gratis | Recibir en `@dominio` y reenviar a un Gmail | **Exige apuntar los NS a Cloudflare, no a Vercel**; no permite enviar |

En cualquiera de las tres, lo que la app necesita para mandar sus avisos es **Resend** con el dominio verificado
(`RESEND_API_KEY` + `CLUB_MAIL_FROM`), que se configura en Vercel DNS sin tocar el correo.

## Registros que quedan en Vercel DNS una vez delegado

| Tipo | Nombre | Valor | Para qué |
|---|---|---|---|
| A | `@` | `76.76.21.21` | Sitio en el dominio raíz (Vercel lo crea) |
| CNAME | `www` | `cname.vercel-dns.com` | Alias `www` (Vercel lo crea) |
| MX | `@` | según proveedor | Recibir correo |
| TXT | `@` | `v=spf1 include:… ~all` | SPF del proveedor |
| TXT | `resend._domainkey` | el que da Resend | DKIM de los avisos de la app |
