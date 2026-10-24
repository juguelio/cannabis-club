import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { cancelPickup, portalOverview } from "@/lib/pickups";

const Body = z.object({ reason: z.string().max(300).optional() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const member = await requireMember();
    const { id } = await ctx.params;
    const body = Body.parse(await req.json().catch(() => ({})));
    await cancelPickup({
      id,
      actorId: member.id,
      memberId: member.memberId,
      reason: body.reason?.trim() || "El socio canceló su reserva",
    });
    return json({ overview: await portalOverview(member.memberId) });
  } catch (error) {
    return fail(error);
  }
}
