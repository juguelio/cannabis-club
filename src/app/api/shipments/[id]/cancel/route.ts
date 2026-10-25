import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { clientIp, fail, json } from "@/lib/http";
import { cancelShipment } from "@/lib/shipments";

const Body = z.object({ reason: z.string().trim().min(3).max(200) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(["ADMIN", "OPERADOR"]);
    const { id } = await ctx.params;
    const { reason } = Body.parse(await req.json());
    const shipment = await cancelShipment({ id, actorId: session.id, reason, ip: clientIp(req) });
    return json({ shipment: { id: shipment.id, status: shipment.status } });
  } catch (error) {
    return fail(error);
  }
}
