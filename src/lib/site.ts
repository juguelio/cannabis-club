/**
 * Identidad del despliegue y origen público: una sola fuente para todo lo que necesita una URL
 * absoluta (metadata, sitemap, robots, links de correo, QR del carnet).
 *
 * Un club nuevo se pone en marcha con variables de entorno, no tocando código:
 *   APP_BASE_URL  → dominio público del despliegue (sin barra final)
 *   CLUB_NOMBRE   → nombre que usan los correos, que se arman fuera de un request y no leen la base
 *   CLUB_SIGLA    → hasta 3 letras para el monograma de los correos (si no hay logo)
 *   CLUB_LOGO_URL → logo absoluto para la cabecera de los correos (opcional; sin esto va el monograma)
 *
 * Todo lo que se muestra en pantalla sale de `Club` (base), no de acá: esto es sólo el respaldo.
 */

const porDefecto = "http://localhost:3300";

export function siteUrl(): string {
  return (process.env.APP_BASE_URL?.trim() || porDefecto).replace(/\/+$/, "");
}

/** El dominio sin protocolo, para mostrarlo como texto en un correo. */
export function siteHost(): string {
  return siteUrl().replace(/^https?:\/\//, "");
}

export function clubNombre(): string {
  return process.env.CLUB_NOMBRE?.trim() || "Club de Cultivo";
}

export function clubSigla(): string {
  const propia = process.env.CLUB_SIGLA?.trim();
  if (propia) return propia.slice(0, 3).toUpperCase();
  const palabras = clubNombre().split(/\s+/).filter((w) => w.length > 2);
  return (palabras.slice(0, 2).map((w) => w[0]).join("") || "CC").toUpperCase();
}

/** Logo absoluto para los correos, o cadena vacía si el club todavía no cargó uno. */
export function logoUrl(): string {
  return process.env.CLUB_LOGO_URL?.trim() || "";
}
