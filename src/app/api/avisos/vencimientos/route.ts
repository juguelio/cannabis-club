import { route } from "@/lib/api";
import { esCron, NO_AUTORIZADO } from "@/lib/cron";
import { requireUser } from "@/lib/auth";
import { correrAvisosVencimiento } from "@/lib/avisos-auto";

/**
 * Aviso de vencimiento del REPROCANN.
 *
 * GET lo llama el cron de Vercel (sin sesión, con `Authorization: Bearer $CRON_SECRET`) y
 * POST lo puede apretar un ADMIN a mano desde el club para probarlo.
 */
export const GET = route(async (req) => {
  if (!esCron(req)) {
    return new Response(JSON.stringify(NO_AUTORIZADO), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  return { ...(await correrAvisosVencimiento()), origen: "cron" };
});

export const POST = route(async () => {
  await requireUser(["ADMIN"]);
  const resultado = await correrAvisosVencimiento();
  return {
    ...resultado,
    origen: "manual",
    mensaje: !resultado.mailer
      ? "El correo saliente no está configurado: no se mandó nada. Los socios por vencer siguen en la cola de avisos."
      : resultado.porVencer === 0
        ? `No hay socios con el REPROCANN a ${resultado.umbral} días o menos.`
        : `${resultado.enviados} avisos enviados, ${resultado.yaAvisados} ya estaban avisados y ${resultado.sinEmail} sin email.`,
  };
});
