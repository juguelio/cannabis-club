/**
 * Piezas compartidas de los correos del club: paleta, letras y funciones de armado.
 *
 * Existe para que el aviso transaccional y la carta del club no se dibujen dos veces con dos
 * criterios. Los colores salen de `src/app/globals.css` —si cambia la marca, cambian los dos— y
 * las letras van primero con sustituto: los clientes de correo no bajan fuentes web.
 */

export const MARCA = {
  pino: "#10231b",
  pino2: "#17342a",
  papel: "#ffffff",
  niebla: "#edf0ec",
  tinta: "#142019",
  tinta2: "#3c4a42",
  muted: "#637068",
  linea: "#d9e0d8",
  hoja: "#1f5a3f",
  violeta: "#5a33a3",
  violetaSuave: "#efe9fa",
  onDark: "#f4f8f5",
  onDark3: "#9fb8aa",
  acentoSuave: "#cbb5f5",
} as const;

export const FUENTE_TITULO =
  "'Bricolage Grotesque','Bricolage Grotesque Variable',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
export const FUENTE_TEXTO =
  "'Instrument Sans','Instrument Sans Variable',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export const LOGO_URL = "https://republicacannabis.com.ar/logo-republica.png";
export const SITE_URL = "https://republicacannabis.com.ar";

/** Escapa lo que escribe el operador: motivo de rechazo, títulos de nota, nombres de variedad. */
export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Cabecera oscura con el logo y el nombre del club. `kicker` es la línea chiquita de arriba:
 * en el aviso es el tipo de club, en la carta es la edición.
 */
export function cabecera(kicker = "Asociación Civil · REPROCANN"): string {
  const { onDark, onDark3 } = MARCA;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="52" valign="middle" style="padding-right:14px;">
                  <img src="${LOGO_URL}" width="44" height="50" alt="República Cannabis" style="display:block;border:0;outline:none;text-decoration:none;width:44px;height:auto;">
                </td>
                <td valign="middle">
                  <div style="font:700 17px/1.2 ${FUENTE_TITULO};color:${onDark};letter-spacing:-.01em;">República Cannabis</div>
                  <div style="font:500 11.5px/1.4 ${FUENTE_TEXTO};color:${onDark3};letter-spacing:.06em;text-transform:uppercase;margin-top:3px;">${esc(kicker)}</div>
                </td>
              </tr>
            </table>`;
}

/** Pie oscuro con las líneas de razón del envío y el link al sitio. */
export function pieCorreo(lineas: string[]): string {
  const { pino2, onDark3, acentoSuave } = MARCA;
  const parrafos = lineas
    .map((p) => `              <p style="margin:0 0 8px;font:400 12.5px/1.6 ${FUENTE_TEXTO};color:${onDark3};">${esc(p)}</p>`)
    .join("\n");
  return `<td style="background:${pino2};border-radius:0 0 16px 16px;padding:22px 26px 26px;">
${parrafos}
            <p style="margin:14px 0 0;font:400 12.5px/1.6 ${FUENTE_TEXTO};color:${onDark3};">
              <a href="${SITE_URL}" style="color:${acentoSuave};text-decoration:none;">republicacannabis.com.ar</a>
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
        República Cannabis · Club de cultivo inscripto en REPROCANN · San Martín de los Andes, Neuquén
      </div>
    </td>
  </tr>
</table>
</body>
</html>`;
}
