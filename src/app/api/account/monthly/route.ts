import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { chargeMonthlyFees } from "@/lib/account";

const Body = z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

/** Genera la cuota social del período. Idempotente: no la cobra dos veces al mismo socio. */
export async function POST(req: Request) {
  try {
    const session = await requireUser(["ADMIN"]);
    const body = Body.parse(await req.json());
    const result = await chargeMonthlyFees(body.period, session.id);
    return json(result);
  } catch (error) {
    return fail(error);
  }
}
