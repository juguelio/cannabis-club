import { prisma } from "@/lib/db";
import { verificarSocio } from "@/lib/baja";
import { grantConsent } from "@/lib/privacy";
import { clubNombre } from "@/lib/site";

/** El nombre del club lo escribe el operador en una variable de entorno: se escapa igual. */
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Sumarse a la carta del club desde un link, sin entrar al portal.
 *
 * Existe porque el consentimiento hay que pedirlo, no suponerlo: a los socios que ya estaban en el
 * padrón cuando el club empezó a mandar la carta no se les puede escribir «novedades» sin que hayan
 * dicho que sí. Este link es la forma de preguntarles en un toque.
 *
 * **GET no da de alta nada**: muestra la pregunta con un botón. Los clientes de correo y los
 * antivirus abren los links solos, y un alta disparada por una vista previa no sería un
 * consentimiento. El alta la hace el POST, que sólo ocurre si alguien apretó.
 */

const PALETA = { pino: "#1f2933", hoja: "#2f6f4f", papel: "#fff", tinta: "#1a2027", tinta2: "#3d4652", linea: "#dfe3e8" };

function pagina(titulo: string, cuerpo: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${titulo} · ${clubNombre()}</title></head>
<body style="margin:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<main style="max-width:520px;margin:0 auto;padding:64px 24px;">
  <div style="background:${PALETA.papel};border:1px solid ${PALETA.linea};border-radius:16px;overflow:hidden;">
    <div style="background:${PALETA.pino};padding:20px 24px;color:#f4f8f5;font-weight:700;font-size:15px;">${esc(clubNombre())}</div>
    <div style="padding:28px 24px;">
      <h1 style="margin:0 0 12px;font-size:23px;line-height:1.25;color:${PALETA.pino};">${titulo}</h1>
      ${cuerpo}
    </div>
  </div>
  <p style="text-align:center;font-size:12px;color:#64707d;margin-top:16px;">${esc(clubNombre())}</p>
</main>
</body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

const SIN_TOKEN =
  "No pudimos leer el link. Puede estar incompleto: probá abrirlo de nuevo desde el mensaje, o entrá al portal y activala desde «Privacidad y permisos».";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  const verificado = verificarSocio(token);
  if (!verificado.ok) return pagina("No pudimos leer el link", `<p style="margin:0;font-size:15px;line-height:1.6;color:${PALETA.tinta2}">${SIN_TOKEN}</p>`, 400);

  const socio = await prisma.member.findUnique({
    where: { id: verificado.memberId },
    select: { firstName: true, consents: { where: { purpose: "COMUNICACIONES" }, select: { revokedAt: true } } },
  });
  if (!socio) return pagina("No pudimos leer el link", `<p style="margin:0;font-size:15px;line-height:1.6;color:${PALETA.tinta2}">${SIN_TOKEN}</p>`, 404);

  const yaRecibe = socio.consents.some((c) => !c.revokedAt);
  if (yaRecibe) {
    return pagina(
      "Ya recibís la carta",
      `<p style="margin:0;font-size:15px;line-height:1.6;color:${PALETA.tinta2}">Hola ${socio.firstName}: tu casilla ya está anotada. Si querés dejar de recibirla, el pie de cada carta tiene el link de baja.</p>`
    );
  }

  return pagina(
    `Hola ${socio.firstName}: ¿querés recibir la carta del club?`,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${PALETA.tinta2}">
      Es la carta mensual: qué cambió en el club, fechas de entrega y cómo viene el mes. No son los avisos
      de tu trámite —esos te siguen llegando igual— y te podés dar de baja cuando quieras.
    </p>
    <form method="post" action="/api/carta/alta?t=${encodeURIComponent(new URL(req.url).searchParams.get("t") ?? "")}">
      <button type="submit" style="display:inline-block;border:0;cursor:pointer;padding:14px 22px;border-radius:10px;background:${PALETA.hoja};color:#f2f8f4;font:700 15px/1 inherit;">Sí, quiero recibirla</button>
    </form>
    <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:${PALETA.tinta2}">Si no querés, no hagas nada: el club no te va a anotar.</p>`
  );
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  const verificado = verificarSocio(token);
  if (!verificado.ok) return pagina("No pudimos leer el link", `<p style="margin:0;font-size:15px;line-height:1.6;color:${PALETA.tinta2}">${SIN_TOKEN}</p>`, 400);

  const socio = await prisma.member.findUnique({ where: { id: verificado.memberId }, select: { firstName: true, id: true } });
  if (!socio) return pagina("No pudimos leer el link", `<p style="margin:0;font-size:15px;line-height:1.6;color:${PALETA.tinta2}">${SIN_TOKEN}</p>`, 404);

  // Sin `actorId`: lo pidió el socio desde su link, no una persona del club con sesión.
  await grantConsent({ memberId: socio.id, purpose: "COMUNICACIONES", actorId: null, note: "Alta desde el link de la carta" });
  return pagina(
    "Listo, quedaste anotado",
    `<p style="margin:0;font-size:15px;line-height:1.6;color:${PALETA.tinta2}">
      Hola ${socio.firstName}: vas a recibir la carta del club. El pie de cada carta tiene el link para darte de baja
      si cambiás de idea.
    </p>`
  );
}

export const dynamic = "force-dynamic";
