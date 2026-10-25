import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { recallBatch } from "@/lib/batch-quality";

const Body = z.object({ reason: z.string().trim().min(5).max(300) });

/** Recall: retira el lote del mercado y deja registro de a quién avisar (REA 5.4). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(["ADMIN"]);
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());
    const result = await recallBatch({ batchId: id, actorId: session.id, reason: body.reason });
    return json({ batch: { id: result.batch.id, stage: result.batch.stage }, affectedMembers: result.affectedMembers });
  } catch (error) {
    return fail(error);
  }
}
