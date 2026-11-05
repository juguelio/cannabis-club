# Alta de un club nuevo (checklist)

Este repo es un **template**: una app de gestión completa para clubes de cultivo con REPROCANN, sin la
identidad de ningún club en particular. Poner un club nuevo en marcha es **configuración + datos**, no
programación. La regla que ordena todo: *lo que cambia de un club a otro no se escribe en el código*.

Nada de este documento requiere tocar `globals.css`, los componentes ni la base a mano.

---

## 0. Qué es del template y qué es del club

| Capa | Dónde vive | Quién la cambia |
|---|---|---|
| Paleta, tipografía, logo, textos del sitio | `Club.marca` (Configuración › Marca) | el club, desde la app |
| Nombre legal, CUIT, personería, director médico, responsable técnico | `Club` (Configuración › Datos del club) | el club |
| Topes, aportes, precios, horarios, envíos | `Club`, `ScheduleRule`, `ClosedDay` | el club |
| Dominio, correo saliente, credenciales | variables de entorno del despliegue | quien despliega |
| Reglas de negocio, pantallas, modelo de datos | el código | el template |

La identidad del club **nunca** se hardcodea. Si aparece un nombre, un CUIT, un domicilio o un dominio escrito
en el código, es un bug del template.

---

## 1. Clonar y desplegar el despliegue del club (uno por club)

Un club = un deploy = una base. No se comparte base entre clubes.

```bash
git clone <repo> club-<nombre> && cd club-<nombre>
npm install
cp .env.example .env.local        # completar DATABASE_URL, AUTH_SECRET, APP_BASE_URL
```

| Variable | Para qué | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Postgres del club | `postgresql://user:pass@host/db?sslmode=require` |
| `AUTH_SECRET` | firma de sesión | `openssl rand -hex 32` |
| `APP_BASE_URL` | dominio público: metadata, sitemap, robots, QR, links de correo | `https://clubx.com.ar` |
| `CLUB_NOMBRE` | nombre en los correos (se arman fuera de un request) | `Club X` |
| `CLUB_SIGLA` | monograma del correo cuando no hay logo | `CX` |
| `CLUB_LOGO_URL` | logo absoluto para la cabecera del correo | `https://clubx.com.ar/logo.png` |
| `RESEND_API_KEY`, `CLUB_MAIL_FROM` | correo saliente | ver [`docs/resend.md`](docs/resend.md) |
| `BAJA_SECRET` | links de baja firmados | `openssl rand -hex 32` |
| `DOC_ENC_KEY`, `DOC_HASH_KEY` | documentos del legajo | ver [`docs/privacidad.md`](docs/privacidad.md) |
| `CRON_SECRET` | cron de avisos y retención | `openssl rand -hex 32` |
| `PROD_DB_FINGERPRINT` | frena un seed contra producción | lo imprime `scripts/dev-db.sh` |

Contra una base nueva:

```bash
npx prisma migrate deploy
npm run db:seed        # datos demo: sirven para mostrar, no para operar
```

> El seed crea un club **demo** con CUIT `30-00000000-0`. La app marca esos valores como faltantes en el panel
> hasta que se carguen los reales: no se opera un club con datos de demo.

---

## 2. Marca (Configuración › Marca)

La base visual del template es **neutra y deliberadamente simple**: grises, un verde sobrio de acción, azul
para foco y selección, tipografía del sistema (0 kB de fuentes web), radios chicos. Ningún club tiene que
"deshacer" una identidad ajena.

Desde el editor de marca se define, con vista previa en vivo:

1. **Colores**: primario (acción), acento (foco y selección), oscuro (barra lateral, balanza, portal), fondo
   claro y firma. Hay cuatro paletas de partida; después se ajustan los cinco colores a mano. El editor corrige
   contraste (WCAG AA) y avisa qué ajustó.
2. **Tipografías**: sistema por defecto; Bricolage Grotesque, Montserrat e Instrument Sans como opción.
3. **Logo** (va sobre placa clara si el logo tiene contorno oscuro), **emblema** y **portada**.
4. **Estilo**: `sobrio` (la app tal cual) o `afiche` (títulos en mayúscula, botones con trazo).
5. **Sigla** (monograma cuando no hay logo), lema y presentación institucional.
6. **Contacto**: WhatsApp, Instagram, email, zona, horario.
7. **Sitio público**: encendido/apagado, pasos de asociación, envíos.

Guardado esto, el sitio público, el portal, el carnet y los correos muestran la cara del club. Sin marca
configurada, la app se ve con la base neutra del template.

> **La marca es todo-o-nada**: si se escribe por SQL y queda inválida, la app cae a la base neutra. Se carga
> desde la pantalla, no por SQL.

---

## 3. Datos que sólo el club puede declarar

Configuración › Datos del club (alimentan libros, informe semestral e inspección):

- nombre legal, CUIT, personería jurídica, REPS, domicilio legal
- inscripción del club en el REPROCANN (número y código de vinculación)
- director médico y matrícula, responsable técnico y título (Res. 1780/2025)

El panel recuerda los que faltan o siguen con valor de demo. **Nadie los inventa por el club**: el informe
semestral es una declaración jurada que depende de ellos.

Después: topes (diario, mensual, menores, THC), aporte por gramo y cotización, precios de membresía y envío,
horarios de atención, días cerrados y usuarios del equipo (`ADMIN`, `OPERADOR`).

---

## 4. Dominio y correo

1. Dominio en `nic.ar`, `APP_BASE_URL` con el dominio canónico, y el `*.vercel.app` redirigido.
2. Resend: verificar el dominio, cargar `RESEND_API_KEY`, `CLUB_MAIL_FROM` y `CLUB_MAIL_REPLY_TO`
   (paso a paso en [`docs/resend.md`](docs/resend.md)).
3. Google Sign-In (opcional): [`docs/google-signin.md`](docs/google-signin.md) — la URL de callback sale de
   `APP_BASE_URL`.

Verificación mínima después de cambiar dominio o marca: pedir `/sitio` **sin sesión** (200 y el nombre del
club), `/llms.txt` (se genera con los datos reales del club) y `/api/health`.

---

## 5. Verificación antes de entregar

```bash
npm test          # 400+ reglas de dominio (vitest)
npx tsc --noEmit  # tipos
npm run build     # build de producción
```

Y en la app, con datos del club:

- [ ] `/sitio` público se ve con la marca del club y responde 200 sin sesión.
- [ ] Login de `ADMIN`; el panel no muestra el recordatorio de datos legales faltantes.
- [ ] Alta de un socio de prueba con DNI + REPROCANN y sus documentos.
- [ ] Entrega en el dispensario: respeta tope diario/mensual y no deja entregar sin REPROCANN vigente.
- [ ] Anulación por contra-asiento; el stock vuelve y queda en `AuditLog`.
- [ ] Cierre mensual y exportación del libro de dispensaciones.
- [ ] Un aviso de vencimiento llega por correo (con Resend configurado).
- [ ] `/llms.txt` menciona el nombre legal real y no queda ningún dato de demo.

---

## 6. Límites conocidos

- El seed es de demostración: nombres, CUIT y legajos son ficticios y la app los señala como faltantes.
- El sistema no da asesoría legal ni médica: el club aporta sus datos y sus topes por escrito.
- La base neutra no incluye fuentes web. Si un club elige una tipografía propia, se sirve desde
  `@fontsource` (ya instalado) y se activa desde el editor de marca.
- Los correos usan la paleta base del template, no la del club: los clientes de correo no cargan variables
  CSS ni fuentes web. Si hace falta que un club tenga correos con su paleta, se ajusta `src/lib/email-brand.ts`.
