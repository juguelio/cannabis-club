import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { releaseBatch } from "@/lib/batch-quality";
import { calendarDate, gramsAmount } from "@/lib/validation";

const Checklist = z.object({
  moho: z.boolean(),
  extrana: z.boolean(),
  humedad: z.boolean(),
  olor: z.boolean(),
});

const Body = z.object({
  checklist: Checklist.optional(),
  thcPct: z.number().min(0).max(100).nullable().optional(),
  cbdPct: z.number().min(0).max(100).nullable().optional(),
  labName: z.string().trim().max(120).optional(),
  labDate: calendarDate.optional(),
  labResult: z.string().trim().max(200).optional(),
  sampleRetainedG: gramsAmount.optional(),
  sampleUntil: calendarDate.optional(),
  note: z.string().trim().max(300).optional(),
  noAnalysisAcknowledged: z.boolean().optional(),
});

/** Liberación del lote: la firma de calidad que habilita entregar (REA 5.1). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(["ADMIN", "OPERADOR"]);
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());
    const batch = await releaseBatch({ batchId: id, ...body, checklist: body.checklist ?? {}, actorId: session.id, isAdmin: session.role === "ADMIN" });
    return json({ batch: { id: batch.id, stage: batch.stage, releasedAt: batch.releasedAt } });
  } catch (error) {
    return fail(error);
  }
}
