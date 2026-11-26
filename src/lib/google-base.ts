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

export function esHostDeLaApp(host: string): boolean {
  const limpio = host.toLowerCase().replace(/:\d+$/, "");
  if (LOCAL.has(limpio)) return true;
  if (HOSTS_PROPIOS.includes(limpio)) return true;
  return VERCEL_DEL_PROYECTO.test(limpio);
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
