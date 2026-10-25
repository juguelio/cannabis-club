import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { notFound } from "@/lib/errors";
import { shipmentDetail } from "@/lib/shipments";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const shipment = await shipmentDetail(id);
    if (!shipment) throw notFound("Traslado inexistente");
    return json({ shipment });
  } catch (error) {
    return fail(error);
  }
}
