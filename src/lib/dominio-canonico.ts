/**
 * Un solo dominio para el club: `.com.ar`.
 *
 * `.org.ar` sirve el mismo sitio (la asociación civil vive ahí), pero **Google no lo tiene autorizado**
 * como `redirect_uri`: entrar por `.org.ar` y tocar «Continuar con Google» termina en
 * «Acceso bloqueado: Error 400: redirect_uri_mismatch». No es algo que la app pueda resolver sola: el
 * cliente OAuth sólo acepta las URIs cargadas en Google Cloud, y ahí figura el `.com.ar`.
 *
 * Pasa lo mismo —y peor— con los hosts de Vercel: **cambian en cada deploy**, así que el `redirect_uri`
 * que manda el flujo nunca va a estar autorizado. No se puede cargar en Google Cloud algo que cambia en
 * cada build; medido el 27/11 con click real, el deploy nuevo responde «Access blocked: This app's
 * request is invalid» mientras el dominio del club acepta.
 *
 * La decisión del club ya estaba escrita (`docs/dominio-y-emails.md`): `.com.ar` canónico y los alias
 * redirigidos. Esto la aplica: el pedido que llega por un alias se manda al canónico **antes** de que la
 * app lo atienda, así el flujo de Google arranca siempre en el host autorizado y la cookie de `state`
 * queda donde la vuelta la va a buscar.
 *
 * Regla pura, para poder probarla sin levantar el server.
 */

/** Dominio canónico, sin `www` y sin barra final. */
export const DOMINIO_CANONICO = "republicacannabis.com.ar";

/** Alias que se redirigen. `www` es un host distinto para una cookie y para Google. */
export const HOSTS_ALIAS = ["republicacannabis.org.ar", "www.republicacannabis.org.ar"];

/**
 * Deploys de Vercel del proyecto en el team: `cannabis-club-<hash>-patagonia-sounds.vercel.app` y los
 * previews de rama (`cannabis-club-git-<rama>-patagonia-sounds`).
 *
 * Van al canónico por la misma razón que `.org.ar`: el host del deploy no está —y no puede estar— en la
 * lista de `redirect_uri` autorizados de Google.
 *
 * El alias `cannabis-club-mauve.vercel.app` **no** entra: su `redirect_uri` sí está autorizado (medido
 * con click real el 27/11) y hace de respaldo si el dominio propio falla. Tampoco entra el proyecto
 * hermano `cannabis-club-template`, que no lleva el sufijo del team.
 */
const DEPLOY_EN_EL_TEAM = /^cannabis-club-[a-z0-9-]+-patagonia-sounds\.vercel\.app$/;

/** Deja el host comparable: minúsculas, sin lista de proxies y sin puerto. */
const normalizar = (host: string) =>
  (host ?? "").toLowerCase().split(",")[0].trim().replace(/:\d+$/, "");

/** ¿Este host es un alias que hay que llevar al dominio propio? */
export function esAlias(host: string): boolean {
  const limpio = normalizar(host);
  if (!limpio) return false;
  if (HOSTS_ALIAS.includes(limpio)) return true;
  return DEPLOY_EN_EL_TEAM.test(limpio);
}

/**
 * A dónde mandar el pedido, o `null` si ya está en el canónico.
 *
 * Devuelve la URL absoluta con el mismo camino y la misma query: un link compartido a
 * `/solicitud?paso=2` tiene que seguir apuntando a lo mismo después del salto.
 */
export function destinoCanonico(host: string, pathname: string, search: string): string | null {
  if (!esAlias(host)) return null;
  const camino = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const query = search && !search.startsWith("?") ? `?${search}` : search;
  return `https://${DOMINIO_CANONICO}${camino}${query}`;
}

/**
 * 301 para lecturas y 308 para el resto.
 *
 * Un 301 sobre un POST hace que el navegador lo repita como GET y sin cuerpo: el formulario se perdería.
 * 308 conserva método y cuerpo, así que un envío que caiga en el alias llega entero al canónico.
 */
export function codigoDeRedireccion(metodo: string): 301 | 308 {
  const m = (metodo ?? "").toUpperCase() || "GET";
  return m === "GET" || m === "HEAD" ? 301 : 308;
}
