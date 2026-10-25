import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { clientIp, fail, json } from "@/lib/http";
import { createShipment, listShipments } from "@/lib/shipments";
import { optionalDate } from "@/lib/validation";

const CreateBody = z.object({
  mode: z.enum(["AEREO", "TERRESTRE"]).default("TERRESTRE"),
  fromAddress: z.string().trim().min(3).max(160),
  toAddress: z.string().trim().min(3).max(160),
  carrierName: z.string().trim().min(3).max(120),
  carrierDoc: z.string().trim().max(20).optional(),
  plannedAt: optionalDate.optional(),
  noticeRef: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(400).optional(),
});

export async function GET() {
  try {
    await requireUser();
    const shipments = await listShipments();
    return json({ shipments });
  } catch (error) {
    return fail(error);
  }
}

/** Abre un traslado en preparación. Se le agregan pacientes y recién después se despacha. */
export async function POST(req: Request) {
  try {
    const session = await requireUser(["ADMIN", "OPERADOR"]);
    const body = CreateBody.parse(await req.json());
    const shipment = await createShipment({
      ...body,
      plannedAt: body.plannedAt ? new Date(`${body.plannedAt}T12:00:00.000Z`) : null,
      createdById: session.id,
    });
    await clientIp(req);
    return json({ shipment }, 201);
  } catch (error) {
    return fail(error);
  }
}
