import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { clientIp, fail, json } from "@/lib/http";
import { voidDispensation } from "@/lib/dispensary";

const Body = z.object({ reason: z.string().min(5) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(["ADMIN"]);
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());
    const dispensation = await voidDispensation({ dispensationId: id, actorId: user.id, reason: body.reason });
    return json({ dispensation, ip: clientIp(req) });
  } catch (error) {
    return fail(error);
  }
}
