import { requireUser } from "@/lib/auth";
import { clientIp, fail, json } from "@/lib/http";
import { dispatchShipment } from "@/lib/shipments";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(["ADMIN", "OPERADOR"]);
    const { id } = await ctx.params;
    const shipment = await dispatchShipment({ id, actorId: session.id, ip: clientIp(req) });
    return json({ shipment: { id: shipment.id, code: shipment.code, status: shipment.status, departedAt: shipment.departedAt } });
  } catch (error) {
    return fail(error);
  }
}
