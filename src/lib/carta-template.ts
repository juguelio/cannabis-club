/**
 * La carta del club: el correo editorial, distinto del aviso transaccional.
 *
 * El aviso le habla a una persona sobre su trámite; la carta le habla al padrón sobre el club. Por
 * eso tiene edición, bloques con títulos y una bajada de baja al pie, y por eso no repite el
 * encabezado en mayúscula gritada: se lee, no se anuncia.
 *
 * Reglas que se respetan acá y conviene no romper:
 * - **Sin precios.** El aporte y las membresías son configuración del club y cambian; la carta
 *   cuenta qué pasa y manda al portal, que es donde el número está siempre al día.
 * - **Nada que el sistema no haga.** Si la carta dice «subí la credencial», es porque el portal
 *   tiene esa pantalla.
 * - **Baja a la vista.** Se da de baja respondiendo el correo: todavía no hay endpoint de baja,
 *   así que no se inventa un link que no funciona.
 */
import { cabecera, esc, FUENTE_TEXTO, FUENTE_TITULO, MARCA, pieCorreo, sobre } from "./email-brand";
import { clubNombre } from "./site";

export type BloqueCarta = { titulo: string; texto: string; enlace?: { texto: string; url: string } };

export type CartaClub = {
  /** Línea chica de la cabecera: «Carta del club · noviembre 2026». */
  edicion: string;
  titulo: string;
  copete: string;
  /** La nota de apertura: dos o tres párrafos, sin subtítulo. */
  apertura: string[];
  bloques: BloqueCarta[];
  cta?: { texto: string; url: string };
  /** Línea de baja. Obligatoria: la carta siempre se puede dejar de recibir. */
  baja: string;
  /** Link de baja de un click (firmado). Si falta, el pie sólo invita a responder el correo. */
  bajaUrl?: string;
};

/** Cabeceras para que Gmail y Apple Mail muestren el botón de baja de un click (RFC 8058). */
export function cabecerasBaja(url: string): Record<string, string> {
  return { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

export function plantillaCarta(carta: CartaClub): string {
  const { pino, papel, linea, tinta, tinta2, hoja, violeta, violetaSuave } = MARCA;

  const apertura = carta.apertura
    .map((p) => `            <p style="margin:0 0 16px;font:400 16px/1.65 ${FUENTE_TEXTO};color:${tinta2};">${esc(p)}</p>`)
    .join("\n");

  const bloques = carta.bloques
    .map(
      (b) => `            <tr>
              <td style="padding:20px 0 0;border-top:1px solid ${linea};">
                <div style="font:700 18px/1.3 ${FUENTE_TITULO};color:${pino};letter-spacing:-.015em;margin-bottom:6px;">${esc(b.titulo)}</div>
                <p style="margin:0;font:400 15px/1.6 ${FUENTE_TEXTO};color:${tinta2};">${esc(b.texto)}${
                  b.enlace
                    ? ` <a href="${esc(b.enlace.url)}" style="color:${violeta};text-decoration:none;font-weight:600;">${esc(b.enlace.texto)}</a>`
                    : ""
                }</p>
              </td>
            </tr>
              <tr><td style="height:18px;line-height:18px;font-size:0;">&nbsp;</td></tr>`
    )
    .join("\n");

  const cta = carta.cta
    ? `            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 26px;">
              <tr>
                <td style="background:${hoja};border-radius:10px;">
                  <a href="${esc(carta.cta.url)}" style="display:inline-block;padding:14px 26px;font:700 15px/1 ${FUENTE_TEXTO};color:#f2f8f4;text-decoration:none;">${esc(carta.cta.texto)}</a>
                </td>
              </tr>
            </table>`
    : "";

  const contenido = `        <tr>
          <td style="background:${pino};border-radius:16px 16px 0 0;padding:22px 26px;">
            ${cabecera()}
          </td>
        </tr>
        <tr>
          <td style="background:${papel};padding:30px 26px 8px;border-left:1px solid ${linea};border-right:1px solid ${linea};">
            <div style="font:600 11px/1.4 ${FUENTE_TEXTO};letter-spacing:.1em;text-transform:uppercase;color:${violeta};background:${violetaSuave};display:inline-block;padding:5px 10px;border-radius:999px;margin-bottom:14px;">${esc(carta.edicion)}</div>
            <h1 style="margin:0 0 14px;font:800 30px/1.08 ${FUENTE_TITULO};color:${pino};letter-spacing:-.025em;">${esc(carta.titulo)}</h1>
            <p style="margin:0 0 22px;font:600 17px/1.5 ${FUENTE_TEXTO};color:${tinta};">${esc(carta.copete)}</p>
${apertura}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;">
${bloques}
            </table>
${cta}
          </td>
        </tr>
        <tr>
          ${pieCorreo([carta.baja], carta.bajaUrl)}
        </tr>`;

  return sobre(carta.copete, carta.titulo, contenido);
}

/** Respaldo en texto: lo que ve quien no muestra HTML, con los mismos datos y links. */
export function textoCarta(carta: CartaClub): string {
  return [
    `${carta.edicion.toUpperCase()} — ${carta.titulo}`,
    "",
    carta.copete,
    "",
    ...carta.apertura.flatMap((p) => [p, ""]),
    ...carta.bloques.flatMap((b) => [b.titulo.toUpperCase(), b.texto, ...(b.enlace ? [`${b.enlace.texto}: ${b.enlace.url}`] : []), ""]),
    ...(carta.cta ? [`${carta.cta.texto}: ${carta.cta.url}`, ""] : []),
    carta.baja,
    ...(carta.bajaUrl ? [`Darte de baja: ${carta.bajaUrl}`] : []),
    "",
    clubNombre(),
  ].join("\n");
}
