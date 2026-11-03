/**
 * Plantilla de los mails del club. Tablas e estilos en línea porque los clientes de correo
 * (Gmail, Outlook, Apple Mail) tiran el `<style>` y no cargan fuentes web: si el look depende
 * de eso, el mail llega roto. Las letras de la marca van primero en la lista y caen a un
 * sustituto parecido, así se parece al sitio sin depender de que el cliente baje la fuente.
 *
 * Paleta: los mismos valores de `src/app/globals.css` (pino, papel, antocianina).
 */

export type AvisoEmail = {
  /** Encabezado grande, en mayúscula como en el sitio. */
  titulo: string;
  /** Bajada corta, una o dos líneas. */
  copete?: string;
  /** Párrafos del cuerpo: texto plano, se escapan los caracteres peligrosos. */
  parrafos: string[];
  /** Botón opcional. `url` tiene que ser absoluta. */
  cta?: { texto: string; url: string };
  /** Bloque destacado: para el dato que el socio tiene que leer sí o sí (legajo, fecha, motivo). */
  destacado?: { etiqueta: string; valor: string };
  /** Pie: por defecto, la firma del club y la dirección del sitio. */
  pie?: string[];
};

const PINO = "#10231b";
const PINO_2 = "#17342a";
const PAPEL = "#ffffff";
const NIEBLA = "#edf0ec";
const TINTA = "#142019";
const TINTA_2 = "#3c4a42";
const MUTED = "#637068";
const LINEA = "#d9e0d8";
const HOJA = "#1f5a3f";
const VIOLETA = "#5a33a3";
const VIOLETA_SUAVE = "#efe9fa";

/** Las del sitio (Bricolage Grotesque / Instrument Sans) con sustituto honesto. */
const FUENTE_TITULO = "'Bricolage Grotesque','Bricolage Grotesque Variable',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const FUENTE_TEXTO = "'Instrument Sans','Instrument Sans Variable',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const LOGO_URL = "https://republicacannabis.com.ar/logo-republica.png";
export const SITE_URL = "https://republicacannabis.com.ar";

/**
 * Devuelve el HTML del aviso. Sin `<!doctype>` de más, sin fuentes externas, sin imágenes
 * que no sean el logo del propio dominio: nada que el cliente tenga que ir a buscar afuera.
 */
export function plantillaEmail(aviso: AvisoEmail): string {
  const { titulo, copete, parrafos, cta, destacado, pie } = aviso;

  const destacadoHtml = destacado
    ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
              <tr>
                <td style="background:${VIOLETA_SUAVE};border-left:4px solid ${VIOLETA};border-radius:10px;padding:16px 20px;">
                  <div style="font:600 11px/1.4 ${FUENTE_TEXTO};letter-spacing:.09em;text-transform:uppercase;color:${VIOLETA};margin-bottom:6px;">${esc(destacado.etiqueta)}</div>
                  <div style="font:700 20px/1.3 ${FUENTE_TITULO};color:${PINO};letter-spacing:-.01em;">${esc(destacado.valor)}</div>
                </td>
              </tr>
            </table>`
    : "";

  const ctaHtml = cta
    ? `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 26px;">
              <tr>
                <td style="background:${HOJA};border-radius:10px;">
                  <a href="${esc(cta.url)}" style="display:inline-block;padding:14px 26px;font:700 15px/1 ${FUENTE_TEXTO};color:#f2f8f4;text-decoration:none;letter-spacing:.01em;">${esc(cta.texto)}</a>
                </td>
              </tr>
            </table>`
    : "";

  const cuerpo = parrafos
    .map(
      (p) =>
        `            <p style="margin:0 0 16px;font:400 16px/1.62 ${FUENTE_TEXTO};color:${TINTA_2};">${esc(p)}</p>`
    )
    .join("\n");

  const pieLineas = (pie ?? [
    "Recibís este correo porque sos parte del padrón de socios del club.",
    "Si no esperabas este mensaje, escribinos y lo revisamos.",
  ])
    .map(
      (p) =>
        `              <p style="margin:0 0 8px;font:400 12.5px/1.6 ${FUENTE_TEXTO};color:#9fb8aa;">${esc(p)}</p>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${NIEBLA};">
<!-- Preheader: lo que se lee en la lista de la bandeja, oculto en el cuerpo. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(copete ?? titulo)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${NIEBLA};">
  <tr>
    <td align="center" style="padding:28px 14px;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

        <!-- Cabecera: filete de pino con el logo y el nombre del club -->
        <tr>
          <td style="background:${PINO};border-radius:16px 16px 0 0;padding:22px 26px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="52" valign="middle" style="padding-right:14px;">
                  <img src="${LOGO_URL}" width="44" height="50" alt="República Cannabis" style="display:block;border:0;outline:none;text-decoration:none;width:44px;height:auto;">
                </td>
                <td valign="middle">
                  <div style="font:700 17px/1.2 ${FUENTE_TITULO};color:#f4f8f5;letter-spacing:-.01em;">República Cannabis</div>
                  <div style="font:500 11.5px/1.4 ${FUENTE_TEXTO};color:#9fb8aa;letter-spacing:.06em;text-transform:uppercase;margin-top:3px;">Asociación Civil · REPROCANN</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Cuerpo sobre papel -->
        <tr>
          <td style="background:${PAPEL};padding:30px 26px 8px;border-left:1px solid ${LINEA};border-right:1px solid ${LINEA};">
            <h1 style="margin:0 0 14px;font:800 27px/1.1 ${FUENTE_TITULO};color:${PINO};letter-spacing:-.02em;text-transform:uppercase;">${esc(titulo)}</h1>
            ${copete ? `<p style="margin:0 0 22px;font:600 16.5px/1.5 ${FUENTE_TEXTO};color:${TINTA};">${esc(copete)}</p>` : ""}
${destacadoHtml}
${cuerpo}
${ctaHtml}
          </td>
        </tr>

        <!-- Pie -->
        <tr>
          <td style="background:${PINO_2};border-radius:0 0 16px 16px;padding:22px 26px 26px;">
${pieLineas}
            <p style="margin:14px 0 0;font:400 12.5px/1.6 ${FUENTE_TEXTO};color:#9fb8aa;">
              <a href="${SITE_URL}" style="color:#cbb5f5;text-decoration:none;">republicacannabis.com.ar</a>
            </p>
          </td>
        </tr>

      </table>

      <div style="max-width:600px;margin:14px auto 0;font:400 11px/1.5 ${FUENTE_TEXTO};color:${MUTED};text-align:center;">
        República Cannabis · Club de cultivo inscripto en REPROCANN · San Martín de los Andes, Neuquén
      </div>

    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Lista de `parse_mode` seguro: si el cliente no muestra HTML, el texto ya está armado. */
export const textoSinHtml = (titulo: string, parrafos: string[], cta?: { texto: string; url: string }) =>
  [`${titulo.toUpperCase()}`, "", ...parrafos.flatMap((p) => [p, ""]), ...(cta ? [`${cta.texto}: ${cta.url}`] : [])].join("\n");
