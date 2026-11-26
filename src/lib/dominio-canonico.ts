/**
 * Un solo dominio para el club: `.com.ar`.
 *
 * `.org.ar` sirve el mismo sitio (la asociación civil vive ahí), pero **Google no lo tiene autorizado**
 * como `redirect_uri`: entrar por `.org.ar` y tocar «Continuar con Google» termina en
 * «Acceso bloqueado: Error 400: redirect_uri_mismatch». No es algo que la app pueda resolver sola: el
 * cliente OAuth sólo acepta las URIs cargadas en Google Cloud, y ahí figura el `.com.ar`.
 *
 * La decisión del club ya estaba escrita (`docs/dominio-y-emails.md`): `.com.ar` canónico y `.org.ar`
 * redirigido. Esto la aplica: el pedido que llega por el alias se manda al canónico **antes** de que la
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
 * A dónde mandar el pedido, o `null` si ya está en el canónico.
 *
 * Devuelve la URL absoluta con el mismo camino y la misma query: un link compartido a
 * `/solicitud?paso=2` tiene que seguir apuntando a lo mismo después del salto.
 */
export function destinoCanonico(host: string, pathname: string, search: string): string | null {
  const limpio = (host ?? "").toLowerCase().split(",")[0].trim().replace(/:\d+$/, "");
  if (!HOSTS_ALIAS.includes(limpio)) return null;
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
