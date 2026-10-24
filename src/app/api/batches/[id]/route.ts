import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { notFound, unprocessable } from "@/lib/errors";
import { batchBalance } from "@/lib/dispensary";
import { batchTotals, totalsOf } from "@/lib/stock";
import { evaluateStageChange, nextStages, STAGES, type Stage } from "@/lib/batch-rules";

/** Ficha del lote con su trazabilidad completa: libro de movimientos y a quién se entregó. */
export const GET = route<{ id: string }>(async (_req, { id }) => {
  await requireUser();
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      strain: true,
      movements: { orderBy: { occurredAt: "desc" }, include: { actor: { select: { name: true } }, member: { select: { legajo: true, firstName: true, lastName: true } } } },
    },
  });
  if (!batch) throw notFound("Lote inexistente");
  const totals = totalsOf(await batchTotals(prisma, [id]), id);
  return { batch, totals, nextStages: nextStages(batch.stage as Stage) };
});

const Patch = z.object({
  stage: z.enum(STAGES).optional(),
  reason: z.string().trim().max(300).optional(),
  room: z.string().trim().max(60).optional(),
  plantsCount: z.number().int().nonnegative().max(100000).optional(),
  notes: z.string().trim().max(1000).optional(),
});

/** Cambio de etapa y datos de cultivo. Destruir un lote registra la destrucción del saldo en el libro. */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(["ADMIN", "OPERADOR"]);
  const input = await body(req, Patch);

  const batch = await prisma.$transaction(async (tx) => {
    const current = await tx.batch.findUnique({ where: { id } });
    if (!current) throw notFound("Lote inexistente");
    let destroyed = 0;

    if (input.stage && input.stage !== current.stage) {
      const balance = await batchBalance(tx, id);
      const decision = evaluateStageChange({ from: current.stage as Stage, to: input.stage, balanceG: balance, reason: input.reason });
      if (!decision.ok) throw unprocessable(decision.code, decision.message);
      if (input.stage === "DESTRUIDO" && user.role !== "ADMIN")
        throw unprocessable("ADMIN_ONLY", "Destruir un lote lo hace un administrador.");
      if (decision.destroyRemainderG > 0) {
        destroyed = decision.destroyRemainderG;
        await tx.stockMovement.create({
          data: {
            batchId: id,
            type: "DESTRUCCION",
            grams: new Prisma.Decimal(destroyed.toFixed(2)),
            reason: input.reason!,
            actorId: user.id,
          },
        });
      }
    }

    const updated = await tx.batch.update({
      where: { id },
      data: {
        ...(input.stage ? { stage: input.stage } : {}),
        ...(input.room !== undefined ? { room: input.room || null } : {}),
        ...(input.plantsCount !== undefined ? { plantsCount: input.plantsCount } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: input.stage && input.stage !== current.stage ? "BATCH_STAGE" : "BATCH_UPDATE",
        entity: "Batch",
        entityId: id,
        ip: clientIp(req),
        payload: { from: current.stage, ...input, destroyedG: destroyed } as Prisma.InputJsonValue,
      },
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return { batch };
});
