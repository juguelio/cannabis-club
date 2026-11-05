# Deploy — producción

## Estado (verificado 24-oct-2026)

| Pieza | Valor |
|---|---|
| URL | https://<proyecto>.vercel.app |
| Proyecto Vercel | `patagonia-sounds/cannabis-club` (team `team_NRTVM5djaTCwNkCe7biFE0ik`), protección SSO **desactivada** |
| Base | Neon `cannabis-club`, org `org-delicate-glitter-39647088`, `aws-sa-east-1`, Postgres 18 |
| Host directo | `ep-polished-mouse-b6pgnalj.c-2.sa-east-1.aws.neon.tech` |
| Host pooled | `ep-polished-mouse-b6pgnalj-pooler.c-2.sa-east-1.aws.neon.tech` |
| Env Vercel | `DATABASE_URL` (pooled + pgbouncer), `DIRECT_URL`, `AUTH_SECRET` |
| Credenciales | `02-Shared/api-keys.md` del vault |

Verificación real contra producción: `/login` 200 · `/` y `/socios` 307 sin sesión · `POST /api/auth/login`
200 con cookie · `/` y `/socios` 200 con sesión · `GET /api/members` devuelve el padrón. Claves del seed
rotadas (la vieja devuelve 401).

## Deploy automático

El proyecto está conectado al repo `github.com/juguelio/cannabis-club` (rama de producción `main`):
cada push a `main` dispara el deploy. Manual, si hace falta forzarlo:

```bash
cd ~/Dev/cannabis-club
npx vercel deploy --prod --yes
```

Migraciones y seed contra producción (connection string directo, no el pooled):

```bash
export DATABASE_URL="$(cat ~/.config/cannabis-club-db-url)"
npx prisma migrate deploy && npm run db:seed
```

Rotar claves de usuarios:

```bash
DATABASE_URL="$(cat ~/.config/cannabis-club-db-url)" npx tsx scripts/rotate-user.ts <email> <password>
```

Credenciales locales (600, fuera del repo): `~/.config/cannabis-club-db-url`, `-pooled`,
`~/.config/neon-api-key`, `~/.config/cannabis-club-admin-pass`, `-operador-pass`.

## Por qué Neon y no Supabase

Supabase limita **por usuario** (2 proyectos free activos): la cuenta `juguelio` ya tiene Oficio y
descanso-profundo, y crear en otra org devuelve el mismo error. Neon free permite 10 y su CLI acepta API
key, así que el deploy quedó reproducible sin depender del navegador.

## Antes de onboardear un club real

1. Reemplazar el admin demo por la cuenta del club y borrar `operador@club.test`.
2. Cargar CUIT, director médico y responsable técnico; confirmar topes por escrito.
3. Los 5 socios y 3 lotes del seed son ficticios: borrarlos antes de uso real.
4. Son datos de salud: definir retención y consentimiento informado.
5. Dominio propio: `vercel domains add <dominio>` + DNS.

## Notas técnicas (dolorosas de redescubrir)

- Chrome 136+ ignora `--remote-debugging-port` cuando se usa el perfil real; para automatizar con la
  sesión del usuario hay que copiar `Local State` + `Profile N` a un `--user-data-dir` temporal.
- El WebSocket de CDP rechaza el handshake si se manda `Origin` (403): usar `suppress_origin=True` o
  arrancar Chrome con `--remote-allow-origins=*`.
- `neonctl auth` corta a los 60 s fijos, no configurable: para automatización usar `NEON_API_KEY`.
- `vercel project protection disable` no limpia `ssoProtection`; hay que hacer
  `PATCH /v9/projects/{id}` con `{"ssoProtection": null}`.
- `neonctl connection-string` necesita `--project-id` explícito (el nombre no sirve como posicional).

<!-- deploy automático verificado -->
