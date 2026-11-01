import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { addShipmentItem } from "@/lib/shipments";
import { gramsAmount } from "@/lib/validation";

const Body = z.object({
  memberId: z.string().min(1),
  batchId: z.string().min(1),
  grams: gramsAmount,
  note: z.string().trim().max(200).optional(),
  /** Pedido de envío del portal que cierra este ítem al entregarse. */
  pickupRequestId: z.string().min(1).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(["ADMIN", "OPERADOR"]);
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());
    const item = await addShipmentItem({ shipmentId: id, ...body });
    return json({ item }, 201);
  } catch (error) {
    return fail(error);
  }
}
