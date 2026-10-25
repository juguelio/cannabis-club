import { requireUser } from "@/lib/auth";
import { clientIp, fail, json } from "@/lib/http";
import { deliverShipment } from "@/lib/shipments";

/**
 * Entrega el traslado: cada ítem pasa por el dispensario real (REPROCANN, topes, liberación, recall, stock).
 * Devuelve qué se entregó y qué no, con el motivo.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(["ADMIN", "OPERADOR"]);
    const { id } = await ctx.params;
    const result = await deliverShipment({ id, actorId: session.id, ip: clientIp(req) });
    return json(result);
  } catch (error) {
    return fail(error);
  }
}
