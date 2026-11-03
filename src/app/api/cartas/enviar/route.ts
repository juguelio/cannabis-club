import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { esCron, NO_AUTORIZADO } from "@/lib/cron";
import { procesarCartasProgramadas } from "@/lib/cartas";

/**
 * El trabajo que manda las cartas aprobadas cuya hora llegó.
 *
 * GET lo llama el cron de Vercel (sin sesión, con el `Bearer` del CRON_SECRET); POST lo puede
 * apretar un ADMIN para no esperar la pasada. Corre de madrugada a propósito: si algo falla, el
 * club se entera con el café y no en medio de una campaña.
 */
export const GET = route(async (req) => {
  if (!esCron(req)) {
    return new Response(JSON.stringify(NO_AUTORIZADO), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  return { ...(await procesarCartasProgramadas()), origen: "cron" };
});

export const POST = route(async () => {
  await requireUser(["ADMIN"]);
  const resultado = await procesarCartasProgramadas();
  return {
    ...resultado,
    origen: "manual",
    mensaje:
      resultado.procesadas.length === 0
        ? "No hay cartas aprobadas esperando su hora."
        : `Se procesaron ${resultado.procesadas.length} carta(s); quedan ${resultado.pendientes} en curso.`,
  };
});

export const maxDuration = 60;
