import { calendarDate, gramsAmount } from "@/lib/validation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { clientIp, fail, json } from "@/lib/http";
import { conflict, notFound } from "@/lib/errors";

const Body = z.object({
  wetWeightG: gramsAmount.optional(),
  dryWeightG: gramsAmount.optional(),
  thcPct: z.number().min(0).max(100).optional(),
  cbdPct: z.number().min(0).max(100).optional(),
  harvestedAt: calendarDate.optional(),
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
      if (["AGOTADO", "DESTRUIDO"].includes(batch.stage)) throw conflict("BATCH_CLOSED", "El lote está cerrado.");
      if (!body.wetWeightG && !body.dryWeightG) throw conflict("NOTHING_TO_RECORD", "Indicá el peso húmedo o el seco.");
      const wet = body.wetWeightG ?? (batch.wetWeightG == null ? null : Number(batch.wetWeightG));
      if (body.dryWeightG && wet != null && body.dryWeightG > wet)
        throw conflict("DRY_OVER_WET", `El peso seco (${body.dryWeightG} g) no puede superar al húmedo (${wet} g).`);
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
