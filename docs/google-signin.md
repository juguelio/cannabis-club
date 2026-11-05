# Ingreso con Google

## Qué hace

Google prueba **quién sos**; el club decide **si entrás**. El flujo es OAuth 2.0 Authorization Code con PKCE,
implementado a mano sobre `jose` (la app ya tiene su propia sesión: `cc_session`, HS256, `tokenVersion`).

1. `/login` → **Continuar con Google** → `GET /api/auth/google`.
2. Se genera `code_verifier` + `code_challenge` (S256) y un `nonce`. El nonce y el verifier viajan firmados en una
   cookie `cc_oauth` (httpOnly, 10 min, `path=/api/auth/google`); el query string sólo lleva el nonce.
3. Google devuelve el código a `/api/auth/google/callback`; se valida `state` contra la cookie, se canjea el código y
   se verifica el `id_token` contra el JWKS de Google (`iss`, `aud`, `email_verified`).
4. Se busca la cuenta por `googleSub` o por email y se decide (`src/lib/google-rules.ts`):

| Situación | Resultado |
|---|---|
| Email de Google sin verificar | Rechaza (`email_no_verificado`) |
| Email desconocido | Crea cuenta **SOCIO, inactiva, sin legajo** y avisa «pendiente» |
| Cuenta desactivada | Rechaza (`cuenta_inactiva`) |
| SOCIO sin legajo vinculado | Rechaza (`socio_sin_legajo`) |
| Email atado a otro `sub` de Google | Rechaza (`otra_cuenta_google`) |
| Cuenta activa y con legajo | Abre sesión; la primera vez ata el `sub` |

## Aprobación

Las cuentas pendientes aparecen en **Configuración › Equipo › Accesos pendientes**, con el legajo sugerido cuando el
email coincide con un socio sin cuenta. Habilitar exige elegir legajo (un SOCIO sin legajo no tiene portal);
rechazar borra la cuenta. Todo queda en `AuditLog` (`USER_PENDING`, `USER_APPROVE`, `USER_REJECT`, `LOGIN_GOOGLE`).

## Reglas que no se negocian

- **Nunca se crea una cuenta activa por Google.** El alta automática es siempre inactiva y sin legajo.
- **Nunca se cambia el email de una cuenta** por lo que diga Google: si el email ya está atado a otro `sub`, se rechaza.
- **Una cuenta creada con Google no tiene clave** (`passwordHash` nulo): el login por clave no puede validar. Se le
  puede poner una después desde el cambio de clave (`PASSWORD_SET`), que no pide la clave actual.
- **Techo de altas**: 8 cuentas pendientes por IP cada 24 h (contadas en `AuditLog`), para que un bot no llene el padrón.

## Configuración

Variables (producción + local): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_BASE_URL`.
Si falta cualquiera de las tres, el botón no se muestra y el endpoint vuelve al login con aviso: la app no se rompe.

- Proyecto GCP: `<proyecto>-signin` (cuenta del operador).
- Cliente OAuth: *Web application*; redirects autorizados:
  `https://<dominio>/api/auth/google/callback` y
  `http://127.0.0.1:3321/api/auth/google/callback`.
- Pantalla de consentimiento: tipo **External**; para que entre cualquier cuenta (no sólo test users) hay que
  **publicar la app**, y para publicar Google exige home page y política de privacidad públicas → `/sitio` y `/privacidad`.

## Pendiente

- **Publicar la app** en Google Auth Platform (hoy en *Testing*: sólo entran test users).
- Verificar el tramo final con una cuenta real: Google pidió verificación de identidad (2FA) al perfil usado para
  configurar, así que el canje del código quedó probado sólo en sus guardas.
