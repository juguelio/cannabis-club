import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { memberAccount, registerPayment } from "@/lib/account";

const Body = z.object({
  amountArs: z.coerce.number().positive().max(10_000_000),
  note: z.string().max(300).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(["ADMIN", "OPERADOR"]);
    const { id } = await ctx.params;
    const data = await memberAccount(id);
    return json({
      balance: data.balance,
      count: data.count,
      entries: data.entries.map((e) => ({
        id: e.id,
        kind: e.kind,
        concept: e.concept,
        amountArs: Number(e.amountArs),
        period: e.period,
        occurredAt: e.occurredAt.toISOString(),
        note: e.note,
        voided: Boolean(e.voidedAt),
        reversed: e.reversalOfId != null,
        by: e.creator?.name ?? null,
      })),
    });
  } catch (error) {
    return fail(error);
  }
}

/** Registrar un pago: nunca edita asientos, agrega uno nuevo. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(["ADMIN", "OPERADOR"]);
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());
    await registerPayment({ memberId: id, amountArs: body.amountArs, note: body.note, createdById: session.id });
    const data = await memberAccount(id);
    return json({ balance: data.balance, entries: data.entries.map((e) => ({
      id: e.id, kind: e.kind, concept: e.concept, amountArs: Number(e.amountArs), period: e.period,
      occurredAt: e.occurredAt.toISOString(), note: e.note, voided: Boolean(e.voidedAt), reversed: e.reversalOfId != null,
    })) }, 201);
  } catch (error) {
    return fail(error);
  }
}
