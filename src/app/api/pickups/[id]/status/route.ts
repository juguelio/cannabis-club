import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { listPickups, markPickup } from "@/lib/pickups";

const Body = z.object({ status: z.enum(["CONFIRMADA", "RETIRADA", "VENCIDA"]) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(["ADMIN", "OPERADOR"]);
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());
    await markPickup({ id, status: body.status, actorId: user.id });
    return json({ pickups: await listPickups() });
  } catch (error) {
    return fail(error);
  }
}
