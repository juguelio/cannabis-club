import { prisma } from "./db";
import { conflict, notFound } from "./errors";

export const QUARANTINE_STAGES = ["CUARENTENA"] as const;

/** Cambia la etapa del lote dejando rastro. Cuarentena y liberación son operaciones con auditoría, no un campo libre. */
export async function setBatchStage(input: {
  batchId: string;
  stage: "DISPONIBLE" | "CUARENTENA" | "DESTRUIDO" | "AGOTADO";
  reason?: string;
  actorId: string;
}) {
  const batch = await prisma.batch.findUnique({ where: { id: input.batchId } });
  if (!batch) throw notFound("Lote inexistente");
  if (batch.stage === input.stage) throw conflict("SAME_STAGE", "El lote ya está en esa etapa.");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.batch.update({
      where: { id: batch.id },
      data: { stage: input.stage, notes: input.reason ? `${batch.notes ?? ""}\n[${new Date().toISOString().slice(0, 10)}] ${input.reason}`.trim() : batch.notes },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.stage === "CUARENTENA" ? "BATCH_QUARANTINE" : "BATCH_STAGE_CHANGE",
        entity: "Batch",
        entityId: batch.id,
        payload: { from: batch.stage, to: input.stage, reason: input.reason ?? null },
      },
    });
    return updated;
  });
}

/** Todo lo que hace falta para auditar un lote: libro, entregas y a quién le tocó. */
export async function batchDetail(id: string) {
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      strain: true,
      movements: { orderBy: { occurredAt: "desc" }, include: { actor: true, member: true } },
      dispensations: {
        orderBy: { occurredAt: "desc" },
        include: { member: true, operator: true },
      },
    },
  });
  if (!batch) return null;

  const saldo =
    Math.round(
      batch.movements.reduce(
        (a, m) => a + (["INGRESO", "AJUSTE_POSITIVO", "DISPENSACION_REVERSA"].includes(m.type) ? 1 : -1) * Number(m.grams),
        0,
      ) * 100,
    ) / 100;

  const porSocio = new Map<string, { legajo: number; name: string; grams: number; entregas: number }>();
  for (const d of batch.dispensations) {
    if (d.voidedAt) continue;
    const key = d.memberId;
    const prev = porSocio.get(key) ?? {
      legajo: d.member.legajo,
      name: `${d.member.lastName}, ${d.member.firstName}`,
      grams: 0,
      entregas: 0,
    };
    prev.grams = Math.round((prev.grams + Number(d.grams)) * 100) / 100;
    prev.entregas += 1;
    porSocio.set(key, prev);
  }

  return { batch, saldo, afectados: [...porSocio.values()].sort((a, c) => c.grams - a.grams) };
}
