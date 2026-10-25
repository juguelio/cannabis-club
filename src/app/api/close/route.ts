import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { listCloses, signClose } from "@/lib/monthly-close";

const Body = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  note: z.string().trim().max(300).optional(),
});

export async function GET() {
  try {
    await requireUser(["ADMIN", "OPERADOR"]);
    const closes = await listCloses(24);
    return json({ closes: closes.map((c) => ({ id: c.id, period: c.period, hash: c.hash, signedAt: c.signedAt.toISOString(), by: c.signer.name, note: c.note })) });
  } catch (error) {
    return fail(error);
  }
}

/** Firmar el cierre del período: congela los totales. Sólo ADMIN. */
export async function POST(req: Request) {
  try {
    const session = await requireUser(["ADMIN"]);
    const body = Body.parse(await req.json());
    const close = await signClose({ period: body.period, actorId: session.id, note: body.note });
    return json({ close: { id: close.id, period: close.period, hash: close.hash, signedAt: close.signedAt.toISOString() } }, 201);
  } catch (error) {
    return fail(error);
  }
}
