import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { grantConsent, memberConsents, revokeConsent, CONSENT_PURPOSES, type ConsentPurpose } from "@/lib/privacy";

const Body = z.object({
  purpose: z.enum(Object.keys(CONSENT_PURPOSES) as [ConsentPurpose, ...ConsentPurpose[]]),
  note: z.string().trim().max(300).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(["ADMIN", "OPERADOR"]);
    const { id } = await ctx.params;
    return json({ consents: await memberConsents(id) });
  } catch (error) {
    return fail(error);
  }
}

/** Registrar consentimiento de una finalidad (lo hace el club con el socio presente). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(["ADMIN", "OPERADOR"]);
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());
    await grantConsent({ memberId: id, purpose: body.purpose, actorId: session.id, note: body.note });
    return json({ consents: await memberConsents(id) }, 201);
  } catch (error) {
    return fail(error);
  }
}

/** Revocar: queda la fecha, no se borra el registro. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(["ADMIN"]);
    const { id } = await ctx.params;
    const purpose = new URL(req.url).searchParams.get("purpose") as ConsentPurpose | null;
    if (!purpose || !(purpose in CONSENT_PURPOSES)) throw new Error("Finalidad inválida.");
    await revokeConsent({ memberId: id, purpose, actorId: session.id });
    return json({ consents: await memberConsents(id) });
  } catch (error) {
    return fail(error);
  }
}
