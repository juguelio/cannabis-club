/**
 * Desde qué URL se arranca y se vuelve del ingreso con Google.
 *
 * El `redirect_uri` tiene que caer en el **mismo host** donde se guardó la cookie de `state`. Si no, Google
 * devuelve al socio a un dominio donde esa cookie no existe y el ingreso falla con «el intento venció»:
 * hay que hacerlo de nuevo. Pasaba con cualquier host que no fuera el de `APP_BASE_URL` —el dominio de
 * Vercel, `www.`, una vista previa—, y se sentía como «si entraste por otro lado, no anda».
 *
 * Por eso la base sale del **pedido** cuando el host es de la app, y de `APP_BASE_URL` sólo cuando no lo es
 * (o en desarrollo). Regla pura para poder probarla: la usan `/api/auth/google` y el callback por igual.
 */

/**
 * Dominio propio del club. Sin `www` y con `www` son dos hosts distintos para una cookie.
 *
 * `.org.ar` va incluido: los dos dominios están delegados a Vercel y sirven la app, así que alguien
 * puede empezar el alta ahí. Si el host no figura, la base del flujo cae en `APP_BASE_URL` y la
 * vuelta de Google aterriza en **otro** dominio: la cookie de `state` quedó en `.org.ar` y el
 * ingreso termina en «el intento venció» (comprobado en producción el 25/11).
 *
 * Ojo: estar acá significa «la app sirve este host», **no** «Google lo autoriza». `.org.ar` no está
 * en el cliente OAuth, así que el flujo salta al canónico antes de empezar
 * (`destinoDelFlujoGoogle` + `HOSTS_GOOGLE_AUTORIZADOS`). Si algún día se agrega esa URI en la
 * consola de Google, se suma también a `HOSTS_GOOGLE_AUTORIZADOS` o el salto sigue de más.
 */
export const HOSTS_PROPIOS = [
  "republicacannabis.com.ar",
  "www.republicacannabis.com.ar",
  "republicacannabis.org.ar",
  "www.republicacannabis.org.ar",
];

/** Deploy de Vercel del proyecto: producción (`cannabis-club-mauve`) y vistas previas con hash. */
const VERCEL_DEL_PROYECTO = /^cannabis-club(-[a-z0-9]+)?(-patagonia-sounds)?\.vercel\.app$/i;

const LOCAL = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Hosts cuyo `redirect_uri` está **registrado en el cliente OAuth de Google**.
 *
 * No es la misma lista que «hosts donde sirve la app»: Google valida el `redirect_uri` contra lo que
 * tiene cargado y, si no coincide, corta con `400 redirect_uri_mismatch` —la pantalla de Google
 * «Acceso bloqueado: la solicitud de esta aplicación no es válida», que el socio lee como si la app
 * estuviera rota—. Medido contra `accounts.google.com` el 26/11/2026: `.com.ar`, su `www` y el alias
 * `mauve` estaban autorizados; `.org.ar`, `www.org.ar` y los deploys con hash devolvían 400.
 *
 * Por eso el flujo no arranca en los demás: `destinoDelFlujoGoogle()` manda el navegador al canónico
 * **antes** de crear la cookie de `state`. Cambiar el `redirect_uri` sin mover al socio dejaría la
 * cookie en un host y la vuelta en otro («el intento venció»).
 */
export const HOSTS_GOOGLE_AUTORIZADOS = [
  "republicacannabis.com.ar",
  "www.republicacannabis.com.ar",
  "cannabis-club-mauve.vercel.app",
];

/** Host sin puerto y en minúsculas: `127.0.0.1:3401` y `Reública…` no son hosts distintos. */
function hostSinPuerto(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}

/** Host de una URL de configuración; vacío si no se puede parsear. */
function hostDe(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url.trim()).hostname;
  } catch {
    return "";
  }
}

export function esHostDeLaApp(host: string): boolean {
  const limpio = hostSinPuerto(host);
  if (LOCAL.has(limpio)) return true;
  if (HOSTS_PROPIOS.includes(limpio)) return true;
  return VERCEL_DEL_PROYECTO.test(limpio);
}

/**
 * ¿Google acepta arrancar el flujo en este host?
 *
 * Local cuenta como aceptado: en desarrollo la consola la maneja quien programa y rebotar al canónico
 * sólo agregaría un salto. El host de `APP_BASE_URL` también, porque es el canónico por definición
 * (y evita un rebote a sí mismo si el club cambia de dominio).
 */
export function hostAutorizadoParaGoogle(host: string, appBaseUrl?: string | null): boolean {
  const limpio = hostSinPuerto(host);
  if (!limpio) return false;
  if (LOCAL.has(limpio)) return true;
  if (HOSTS_GOOGLE_AUTORIZADOS.includes(limpio)) return true;
  const canonico = hostSinPuerto(hostDe(appBaseUrl));
  return canonico !== "" && canonico === limpio;
}

/**
 * A dónde saltar antes de empezar el flujo con Google, o `null` si el host del pedido ya sirve.
 *
 * Devuelve la URL absoluta del **mismo endpoint** en el canónico (`APP_BASE_URL`), sin barra final.
 * Sin canónico configurado no hay a dónde saltar: se sigue como está (en local Google ni se dibuja)
 * y nunca se rebota al mismo host, que sería un bucle.
 */
export function destinoDelFlujoGoogle(
  pedido: { origin: string; host: string },
  appBaseUrl: string | null | undefined,
): string | null {
  if (hostAutorizadoParaGoogle(pedido.host, appBaseUrl)) return null;
  const canonica = (appBaseUrl ?? "").trim().replace(/\/+$/, "");
  if (!canonica) return null;
  if (hostSinPuerto(hostDe(canonica)) === hostSinPuerto(pedido.host)) return null;
  let destino: URL;
  try {
    destino = new URL(`${canonica}/api/auth/google`);
  } catch {
    return null;
  }
  // `/api/auth/google` es un GET sin cuerpo: los parámetros del pedido se conservan tal cual.
  destino.search = new URL(pedido.origin).search;
  return destino.toString();
}

/**
 * La base del flujo, sin barra final.
 *
 * - Host de la app (dominio, `www`, Vercel, local): **el del pedido**, así la cookie y la vuelta coinciden.
 * - Cualquier otro host: `APP_BASE_URL`, que es el canónico. Si tampoco hay, el del pedido.
 */
export function baseUrlDelFlujo(
  pedido: { origin: string; host: string },
  appBaseUrl: string | null | undefined,
): string {
  const canonica = (appBaseUrl ?? "").trim().replace(/\/+$/, "");
  const delPedido = pedido.origin.replace(/\/+$/, "");
  if (esHostDeLaApp(pedido.host)) return delPedido;
  return canonica || delPedido;
}

/**
 * De dónde vino el pedido, según lo que ve el navegador.
 *
 * `req.url` no sirve para esto: Next lo arma con `localhost` (y detrás de un proxy, con el host interno),
 * así que un socio que entra por `127.0.0.1` o por el dominio real terminaba con la cookie en un host y la
 * vuelta de Google en otro. Los headers del proxy son la fuente buena.
 */
export function origenDelPedido(url: URL, headers: Headers): { origin: string; host: string } {
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? url.host).split(",")[0].trim();
  const proto = (headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")).split(",")[0].trim();
  return { origin: `${proto}://${host}`, host };
}
