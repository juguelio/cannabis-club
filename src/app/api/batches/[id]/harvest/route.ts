import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { clientIp, fail, json } from "@/lib/http";
import { conflict, notFound } from "@/lib/errors";

const Body = z.object({
  wetWeightG: z.number().positive().optional(),
  dryWeightG: z.number().positive().optional(),
  thcPct: z.number().min(0).max(100).optional(),
  cbdPct: z.number().min(0).max(100).optional(),
  harvestedAt: z.string().optional(),
});

/**
 * Cosecha en dos etapas: primero se registra el peso húmedo (stage COSECHA),
 * después el seco, que es el único que acredita stock (stage DISPONIBLE + INGRESO).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(["ADMIN", "OPERADOR"]);
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());
    const data: Prisma.BatchUpdateInput = {
      ...(body.wetWeightG ? { wetWeightG: new Prisma.Decimal(body.wetWeightG.toFixed(2)), stage: "COSECHA" } : {}),
      ...(body.thcPct !== undefined ? { thcPct: new Prisma.Decimal(body.thcPct.toFixed(2)) } : {}),
      ...(body.cbdPct !== undefined ? { cbdPct: new Prisma.Decimal(body.cbdPct.toFixed(2)) } : {}),
      ...(body.harvestedAt ? { harvestedAt: new Date(`${body.harvestedAt}T00:00:00.000Z`) } : {}),
      ...(body.dryWeightG
        ? { dryWeightG: new Prisma.Decimal(body.dryWeightG.toFixed(2)), stage: "DISPONIBLE" as const }
        : {}),
    };

    const updated = await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.findUnique({ where: { id } });
      if (!batch) throw notFound("Lote inexistente");
      if (batch.dryWeightG) throw conflict("ALREADY_HARVESTED", "El lote ya tiene peso seco registrado.");
      const b = await tx.batch.update({ where: { id }, data });
      if (body.dryWeightG) {
        await tx.stockMovement.create({
          data: {
            batchId: id,
            type: "INGRESO",
            grams: new Prisma.Decimal(body.dryWeightG.toFixed(2)),
            actorId: user.id,
            reason: `Ingreso por cosecha seca ${b.code}`,
          },
        });
      }
      await tx.auditLog.create({ data: { actorId: user.id, action: "BATCH_HARVEST", entity: "Batch", entityId: id, ip: clientIp(req), payload: body } });
      return b;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return json({ batch: updated });
  } catch (error) {
    return fail(error);
  }
}
