import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { clientIp, fail, json } from "@/lib/http";
import { conflict, notFound } from "@/lib/errors";
import { batchBalance } from "@/lib/dispensary";

const Body = z.object({
  batchId: z.string().min(1),
  type: z.enum(["INGRESO", "AJUSTE_POSITIVO", "AJUSTE_NEGATIVO", "DESTRUCCION", "TRANSFERENCIA"]),
  grams: z.number().positive(),
  reason: z.string().min(3),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser(["ADMIN", "OPERADOR"]);
    const body = Body.parse(await req.json());
    const batch = await prisma.batch.findUnique({ where: { id: body.batchId } });
    if (!batch) throw notFound("Lote inexistente");

    const negative = ["AJUSTE_NEGATIVO", "DESTRUCCION", "TRANSFERENCIA"].includes(body.type);
    const movement = await prisma.$transaction(async (tx) => {
      if (negative) {
        const available = await batchBalance(tx, batch.id);
        if (available + 1e-9 < body.grams)
          throw conflict("STOCK_INSUFFICIENT", `El lote ${batch.code} tiene ${available} g disponibles.`);
      }
      return tx.stockMovement.create({
        data: {
          batchId: batch.id,
          type: body.type,
          grams: new Prisma.Decimal(body.grams.toFixed(2)),
          reason: body.reason,
          actorId: user.id,
        },
      });
    });

    await audit({
      actorId: user.id,
      action: "MOVEMENT_CREATE",
      entity: "StockMovement",
      entityId: movement.id,
      ip: clientIp(req),
      payload: { batchId: batch.id, type: body.type, grams: body.grams },
    });
    return json({ movement }, 201);
  } catch (error) {
    return fail(error);
  }
}
