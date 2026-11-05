/**
 * Piezas compartidas de los correos del club: paleta, letras y funciones de armado.
 *
 * Existe para que el aviso transaccional y la carta del club no se dibujen dos veces con dos
 * criterios. La paleta es la misma de `src/app/globals.css` —si el template cambia de base, cambian
 * los dos— y las letras van con la pila del sistema: los clientes de correo no bajan fuentes web.
 *
 * La identidad que no está en la base (nombre, sigla, logo) sale de `src/lib/site.ts`, o sea de las
 * variables de entorno del despliegue: un correo se arma en un cron, sin request y sin marca a mano.
 */
import { clubNombre, clubSigla, logoUrl, siteHost, siteUrl } from "./site";

/** Misma paleta base que `globals.css`. Si cambia una, cambia la otra. */
export const MARCA = {
  pino: "#1f2933",
  pino2: "#27333f",
  papel: "#ffffff",
  niebla: "#f4f5f7",
  tinta: "#1a2027",
  tinta2: "#3d4652",
  muted: "#64707d",
  linea: "#dfe3e8",
  hoja: "#2f6f4f",
  violeta: "#1f5490",
  violetaSuave: "#e8f1fa",
  onDark: "#eef1f5",
  onDark3: "#98a3b1",
  acentoSuave: "#a3c8ec",
} as const;

/** Los clientes de correo no bajan fuentes web: pila del sistema, la misma del template. */
export const FUENTE_TITULO =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const FUENTE_TEXTO = FUENTE_TITULO;

export const SITE_URL = siteUrl();
/** Logo de la cabecera; vacío = monograma con la sigla (ver `cabecera`). */
export const LOGO_URL = logoUrl();

/** Escapa lo que escribe el operador: motivo de rechazo, títulos de nota, nombres de variedad. */
export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Cabecera oscura con el logo y el nombre del club. `kicker` es la línea chiquita de arriba:
 * en el aviso es el tipo de club, en la carta es la edición.
 */
export function cabecera(kicker = "Asociación Civil · REPROCANN", nombre = clubNombre()): string {
  const { onDark, onDark3, acentoSuave, pino } = MARCA;
  // Con logo cargado, la imagen; sin logo, un monograma de texto: nunca un <img> roto.
  const marca = LOGO_URL
    ? `<img src="${LOGO_URL}" width="44" height="44" alt="${esc(nombre)}" style="display:block;border:0;outline:none;text-decoration:none;width:44px;height:44px;object-fit:contain;background:#ffffff;border-radius:8px;">`
    : `<div style="width:44px;height:44px;border-radius:8px;background:${acentoSuave};color:${pino};font:700 15px/44px ${FUENTE_TITULO};text-align:center;">${esc(clubSigla())}</div>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="52" valign="middle" style="padding-right:14px;">${marca}</td>
                <td valign="middle">
                  <div style="font:700 17px/1.2 ${FUENTE_TITULO};color:${onDark};letter-spacing:-.01em;">${esc(nombre)}</div>
                  <div style="font:500 11.5px/1.4 ${FUENTE_TEXTO};color:${onDark3};letter-spacing:.06em;text-transform:uppercase;margin-top:3px;">${esc(kicker)}</div>
                </td>
              </tr>
            </table>`;
}

/** Pie oscuro con las líneas de razón del envío y el link al sitio. */
export function pieCorreo(lineas: string[], bajaUrl?: string): string {
  const { pino2, onDark3, acentoSuave } = MARCA;
  const parrafos = lineas
    .map((p) => `              <p style="margin:0 0 8px;font:400 12.5px/1.6 ${FUENTE_TEXTO};color:${onDark3};">${esc(p)}</p>`)
    .join("\n");
  // La baja va como link y no como invitación a responder: un click, sin pedirle nada al socio.
  const baja = bajaUrl
    ? `            <p style="margin:10px 0 0;font:600 12.5px/1.6 ${FUENTE_TEXTO};"><a href="${esc(bajaUrl)}" style="color:${acentoSuave};text-decoration:underline;">Darte de baja de la carta</a></p>`
    : "";
  return `<td style="background:${pino2};border-radius:0 0 16px 16px;padding:22px 26px 26px;">
${parrafos}${baja}
            <p style="margin:14px 0 0;font:400 12.5px/1.6 ${FUENTE_TEXTO};color:${onDark3};">
              <a href="${SITE_URL}" style="color:${acentoSuave};text-decoration:none;">${siteHost()}</a>
            </p>
          </td>`;
}

/** El sobre: fondo neutro, tarjeta de 600 px centrada, preheader oculto. */
export function sobre(preheader: string, titulo: string, contenido: string): string {
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${MARCA.niebla};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${MARCA.niebla};">
  <tr>
    <td align="center" style="padding:28px 14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
${contenido}
      </table>
      <div style="max-width:600px;margin:14px auto 0;font:400 11px/1.5 ${FUENTE_TEXTO};color:${MARCA.muted};text-align:center;">
        ${esc(clubNombre())} · Club de cultivo inscripto en REPROCANN · Argentina
      </div>
    </td>
  </tr>
</table>
</body>
</html>`;
}
