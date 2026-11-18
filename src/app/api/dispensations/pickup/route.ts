import { z } from "zod";
import { gramsAmount } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { clientIp, fail, json } from "@/lib/http";
import { dispensePickup } from "@/lib/dispensary";

/**
 * Atender una reserva del portal imputando variedad por variedad: una fila por ítem reservado,
 * con su lote y su cantidad. Cada fila es una entrega propia (asiento, cargo y snapshot).
 */
const Body = z.object({
  pickupId: z.string().min(1),
  lines: z
    .array(
      z.object({
        pickupItemId: z.string().min(1),
        batchId: z.string().min(1),
        grams: gramsAmount.max(1000),
      }),
    )
    .min(1)
    .max(24),
  signatureType: z.enum(["REGISTRO_OPERADOR", "PIN", "FIRMA_DIGITAL", "QR"]).optional(),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().min(8).max(120).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser(["ADMIN", "OPERADOR", "DISPENSADOR"]);
    const body = Body.parse(await req.json());
    const result = await dispensePickup({ ...body, operatorId: user.id, ip: clientIp(req) });
    return json(result, result.replay ? 200 : 201);
  } catch (error) {
    return fail(error);
  }
}
