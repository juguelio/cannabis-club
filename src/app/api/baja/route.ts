import { prisma } from "@/lib/db";
import { verificarBaja } from "@/lib/baja";
import { CONSENT_VERSION } from "@/lib/privacy";

/**
 * Baja de la carta del club, de un click y sin sesión.
 *
 * Dos entradas, la misma acción:
 * - **GET** para el link del pie («Darte de baja»).
 * - **POST** para la baja de un click que ofrecen Gmail y Apple Mail (`List-Unsubscribe-Post`): esos
 *   clientes hacen el POST solos y el socio no tiene que abrir nada.
 *
 * Revocar **no borra**: deja la fecha, porque el consentimiento es un registro y no un checkbox.
 * Y la baja alcanza a la carta, no a los avisos del trámite: el club le tiene que poder avisar a un
 * socio que su REPROCANN vence aunque no quiera recibir novedades. La página lo dice con todas las
 * letras para que nadie se sorprenda después.
 */

const PALETA = { pino: "#10231b", hoja: "#1f5a3f", papel: "#fff", tinta: "#142019", tinta2: "#3c4a42", linea: "#d9e0d8" };

function pagina(titulo: string, mensaje: string, detalle: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${titulo} · República Cannabis</title></head>
<body style="margin:0;background:#edf0ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<main style="max-width:520px;margin:0 auto;padding:64px 24px;">
  <div style="background:${PALETA.papel};border:1px solid ${PALETA.linea};border-radius:16px;overflow:hidden;">
    <div style="background:${PALETA.pino};padding:20px 24px;color:#f4f8f5;font-weight:700;font-size:15px;">República Cannabis</div>
    <div style="padding:28px 24px;">
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;color:${PALETA.pino};">${titulo}</h1>
      <p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${PALETA.tinta};">${mensaje}</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:${PALETA.tinta2};">${detalle}</p>
    </div>
  </div>
  <p style="text-align:center;font-size:12px;color:#637068;margin-top:16px;">Asociación Civil República Cannabis · San Martín de los Andes, Neuquén</p>
</main>
</body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

/** Deja el consentimiento de COMUNICACIONES revocado. Si no había, igual queda el registro de la negativa. */
async function darDeBaja(memberId: string): Promise<"revocada" | "sin_socio"> {
  const socio = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!socio) return "sin_socio";
  await prisma.$transaction(async (tx) => {
    const activo = await tx.consent.findFirst({ where: { memberId, purpose: "COMUNICACIONES", revokedAt: null } });
    if (activo) {
      await tx.consent.update({ where: { id: activo.id }, data: { revokedAt: new Date(), note: "Baja desde el correo" } });
    } else {
      // No había consentimiento vivo: se registra la negativa con la versión vigente del texto.
      await tx.consent.create({
        data: {
          memberId,
          purpose: "COMUNICACIONES",
          version: CONSENT_VERSION,
          revokedAt: new Date(),
          note: "Baja desde el correo (sin consentimiento previo vigente)",
        },
      });
    }
    await tx.auditLog.create({
      data: { actorId: null, action: "CONSENT_REVOKE", entity: "Member", entityId: memberId, payload: { purpose: "COMUNICACIONES", origen: "link_de_baja" } },
    });
  });
  return "revocada";
}

const SIN_TOKEN = "No pudimos leer el link de baja. Puede estar incompleto: probá abrirlo de nuevo desde el correo, o respondé el mensaje y te damos de baja a mano.";
const MOTIVOS: Record<string, string> = {
  formato: SIN_TOKEN,
  firma: SIN_TOKEN,
  sin_token: SIN_TOKEN,
  sin_secreto: "El club todavía no tiene configurada la baja automática. Respondé el correo y te damos de baja.",
};

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  const verificado = verificarBaja(token);
  if (!verificado.ok) {
    return pagina("No pudimos darte de baja", MOTIVOS[verificado.motivo] ?? SIN_TOKEN, "El club no tomó ningún dato de este intento.", 400);
  }
  const resultado = await darDeBaja(verificado.memberId);
  if (resultado === "sin_socio") {
    return pagina("No pudimos darte de baja", SIN_TOKEN, "El club no tomó ningún dato de este intento.", 404);
  }
  return pagina(
    "Listo, quedaste fuera de la carta",
    "No vas a recibir más novedades ni la carta mensual del club.",
    "Los avisos de tu trámite —el vencimiento del REPROCANN, la validación de tu legajo— te siguen llegando por correo: son parte del servicio del club, no novedades. Si querés volver a recibir la carta, escribinos y la activamos.",
  );
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  const verificado = verificarBaja(token);
  if (!verificado.ok) return new Response(null, { status: 400 });
  const resultado = await darDeBaja(verificado.memberId);
  return new Response(null, { status: resultado === "sin_socio" ? 404 : 200 });
}

export const dynamic = "force-dynamic";
