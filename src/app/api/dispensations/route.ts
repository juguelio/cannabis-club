import { gramsAmount } from "@/lib/validation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { clientIp, fail, json } from "@/lib/http";
import { dispense } from "@/lib/dispensary";

const Body = z.object({
  memberId: z.string().min(1),
  batchId: z.string().min(1),
  grams: gramsAmount.max(1000),
  signatureType: z.enum(["REGISTRO_OPERADOR", "PIN", "FIRMA_DIGITAL", "QR"]).optional(),
  signatureRef: z.string().optional(),
  notes: z.string().max(500).optional(),
  pickupId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(8).max(120).optional(),
  confirmDuplicate: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireUser();
    const dispensations = await prisma.dispensation.findMany({
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: { member: true, batch: { include: { strain: true } }, operator: { select: { id: true, name: true } } },
    });
    return json({ dispensations });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(["ADMIN", "OPERADOR"]);
    const body = Body.parse(await req.json());
    const result = await dispense({ ...body, operatorId: user.id, ip: clientIp(req) });
    return json(
      {
        dispensation: result.dispensation,
        balanceAfterG: result.availableAfter,
        limits: result.replay ? null : result.decision.snapshot,
        pickupFulfilled: result.pickupFulfilled,
        replay: result.replay,
        batchExhausted: "batchExhausted" in result ? result.batchExhausted : false,
      },
      result.replay ? 200 : 201,
    );
  } catch (error) {
    return fail(error);
  }
}
