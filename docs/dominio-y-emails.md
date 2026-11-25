# Dominio y emails del club

## Estado del dominio (verificado 25-nov-2026)

- **Los dos dominios ya están delegados** a `ns1.vercel-dns.com` / `ns2.vercel-dns.com` y sirven la app: `/api/health`
  responde 200 con `entorno=production` y huella `f04e602c11be` en `.com.ar` y en `.org.ar`.
- `canonical` y `og:url` de `/sitio` apuntan a `https://republicacannabis.com.ar/sitio` en los dos dominios.
- **`APP_BASE_URL` quedó vieja**: hasta el 25-nov seguía siendo `https://cannabis-club-mauve.vercel.app`, así que los
  links absolutos que arma la app (mails de aprobación/rechazo, aviso de vencimiento, cartas, etiqueta con QR) nombran
  el alias de Vercel. Es el único paso que falta de la puesta en marcha: cambiarla y redeployar.
- **`HOSTS_PROPIOS`** (`src/lib/google-base.ts`) lista los cuatro hosts del club (`.com.ar`, `www.com.ar`, `.org.ar`,
  `www.org.ar`). El que falta cae al canónico, la cookie de `state` se queda en el host de entrada y el ingreso muere
  en «el intento venció».

### Cómo se verifica, sin sesión

```bash
# El redirect_uri tiene que llevar el host del pedido; si sale el alias de Vercel, APP_BASE_URL está vieja.
curl -s -o /dev/null -D - https://republicacannabis.com.ar/api/auth/google | grep -i ^location
curl -s -o /dev/null -D - https://republicacannabis.org.ar/api/auth/google  | grep -i ^location
```

Si el `Location` de Google devuelve 302 a `accounts.google.com/v3/signin/identifier` (y no `redirect_uri_mismatch`),
el URI del club está autorizado en Google Cloud.

## Registro histórico (estado al 30-oct-2026)

- **Dominio**: `republicacannabis.com.ar`, registrado en **nic.ar** (creado 27-oct-2026).
- En esa fecha no estaba delegado: la consulta DNS devolvía `NXDOMAIN`. No había sitio, correo ni servicios colgados:
  **nada que migrar ni riesgo de cortar el correo de nadie**.
- **`republicacannabis.org.ar`** también está registrado (mismo CUIT, 29-oct-2026).
- Los dos están agregados al proyecto de Vercel `cannabis-club`, con el dominio raíz y `www` de cada uno.
- **Los nameservers son los mismos para los dos**: son de la cuenta de Vercel, no del dominio. Se pega el mismo par en
  nic.ar dos veces, una por dominio.

## Lo que tiene que hacer el club en nic.ar (5 minutos)

Ingresar con **CUIT/CUIL + Clave Fiscal** (nivel 3 para una asociación) → *Trámites a Distancia* → **NICar** → buscar
`republicacannabis.com.ar` → botón **Delegar** → **Agregar una nueva delegación** y cargar, uno por uno:

| # | Nameserver |
|---|---|
| 1 | `ns1.vercel-dns.com` |
| 2 | `ns2.vercel-dns.com` |

Guardar cada uno y después **Ejecutar cambios** (sin ese último paso no se aplica). nic.ar no tiene zona DNS propia: no
se pueden pegar registros A o MX, sólo nameservers. La delegación figura activa en el transcurso del día.

## Qué dominio queda como principal

Recomendado: **`republicacannabis.com.ar`** como canónico (es el que la gente escribe y el que va en el logo y la firma), y
`republicacannabis.org.ar` **redirigido 301** a él. La asociación civil gana en el `.org.ar`, pero partir el sitio en dos
dominios duplica el SEO y las estadísticas; con una redirección se conserva la identidad sin partir nada.

Lo de `cannabis-club-mauve.vercel.app` cambió de criterio: **no se redirige**, sirve de respaldo si el dominio falla.
Lo que se corrige es `APP_BASE_URL` (arriba), porque mientras apunte al alias, cada link que manda la app lo nombra.

Estado al 25-nov: `.org.ar` todavía **sirve** el sitio (200, con `canonical` al `.com.ar`) en vez de redirigir 301; no
rompe nada, pero quedan dos URLs vivas hasta que se agregue la redirección.

El correo institucional (`admin@`, `hola@`) se crea en el `.com.ar`; el `.org.ar` sólo redirige el sitio.

## Lo que hago yo después (en este orden)

1. Verificar la delegación con `vercel domains inspect` hasta ver *Valid Configuration*.
2. Crear los registros del correo (MX, SPF, DKIM) en Vercel DNS, según el proveedor elegido.
3. `APP_BASE_URL` → `https://republicacannabis.com.ar` y agregar el redirect nuevo en Google Cloud. **(25-nov: la
   delegación ya está; `APP_BASE_URL` sigue en el alias de Vercel — es lo único de esta lista que falta, ver #33.)**
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
