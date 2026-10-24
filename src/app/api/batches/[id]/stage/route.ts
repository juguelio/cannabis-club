import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { setBatchStage } from "@/lib/batch-ops";
import { json } from "@/lib/http";

const Body = z.object({
  stage: z.enum(["DISPONIBLE", "CUARENTENA", "DESTRUIDO", "AGOTADO"]),
  reason: z.string().max(500).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(["ADMIN"]);
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());
    const batch = await setBatchStage({ batchId: id, stage: body.stage, reason: body.reason, actorId: session.id });
    return json({ batch: { id: batch.id, stage: batch.stage } });
  } catch (error) {
    return fail(error);
  }
}
