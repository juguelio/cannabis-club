import { prisma } from "./db";
import { conflict, badRequest } from "./errors";

/**
 * Calidad del lote: liberación con firma, ficha técnica neutra y recall.
 *
 * Reglas de dominio (REA 5.1–5.4):
 * - Nada sale de un lote sin que alguien firme que está apto, y esa firma no puede ser
 *   la de la misma persona que registró la cosecha (segunda firma).
 * - Sin análisis, la ficha lo dice ("pendiente"); nunca se inventa un número.
 * - El recall no borra nada: marca el lote, bloquea entregas y avisa a quien lo recibió.
 */

export const CHECKLIST = [
  { key: "moho", label: "Sin moho ni oídio a la vista" },
  { key: "extrana", label: "Sin materia extraña (tierra, pelos, plástico)" },
  { key: "humedad", label: "Humedad al tacto correcta (no se apelmaza)" },
  { key: "olor", label: "Olor normal, sin olor a humedad" },
] as const;

export type ChecklistKey = (typeof CHECKLIST)[number]["key"];
export type Checklist = Partial<Record<ChecklistKey, boolean>>;

const RELEASABLE = ["CURADO", "DISPONIBLE", "CUARENTENA"] as const;

export type ReleaseInput = {
  stage: string;
  dryWeightG: number | null;
  actorId: string;
  harvestActorId?: string | null;
  checklist: Checklist;
  hasAnalysis: boolean;
  noAnalysisAcknowledged?: boolean;
};

export type ReleaseCheck = { ok: true } | { ok: false; code: string; message: string };

/** Reglas puras de la liberación: se testean sin base. */
export function canRelease(input: ReleaseInput): ReleaseCheck {
  if (!RELEASABLE.includes(input.stage as (typeof RELEASABLE)[number])) {
    return {
      ok: false,
      code: "STAGE_NOT_RELEASABLE",
      message: `El lote está en ${input.stage}: primero registrá el peso seco y el curado.`,
    };
  }
  if (!(Number(input.dryWeightG ?? 0) > 0)) {
    return { ok: false, code: "NO_DRY_WEIGHT", message: "Sin peso seco no hay stock que liberar." };
  }
  if (input.harvestActorId && input.harvestActorId === input.actorId) {
    return {
      ok: false,
      code: "SECOND_SIGNATURE",
      message: "La liberación la firma otra persona: quien registró la cosecha no puede liberar su propio lote.",
    };
  }
  const missing = CHECKLIST.filter((item) => !input.checklist[item.key]).map((item) => item.label);
  if (missing.length) {
    return { ok: false, code: "CHECKLIST_INCOMPLETE", message: `Falta revisar: ${missing.join(" · ")}.` };
  }
  if (!input.hasAnalysis && !input.noAnalysisAcknowledged) {
    return {
      ok: false,
      code: "ANALYSIS_REQUIRED",
      message: "Cargá THC/CBD del análisis, o confirmá que el lote se libera sin análisis (la ficha lo va a decir).",
    };
  }
  return { ok: true };
}

/** Estado público y neutro de la ficha: sin datos personales. */
export function fichaState(batch: {
  stage: string;
  thcPct: number | null;
  cbdPct: number | null;
  labResult: string | null;
  recalledAt: Date | null;
}) {
  const analyzed = batch.thcPct != null || batch.cbdPct != null;
  return {
    recalled: batch.recalledAt != null || batch.stage === "RETIRADO",
    available: batch.stage === "DISPONIBLE" && batch.recalledAt == null,
    thcLabel: batch.thcPct == null ? "Pendiente de análisis" : `${batch.thcPct} %`,
    cbdLabel: batch.cbdPct == null ? "Pendiente de análisis" : `${batch.cbdPct} %`,
    analysisLabel: analyzed ? (batch.labResult ?? "Sin resultado de laboratorio cargado") : "Sin análisis",
  };
}

/** Quién registró la cosecha (o el ingreso de stock) de este lote. */
async function harvestActorOf(batchId: string) {
  const movement = await prisma.stockMovement.findFirst({
    where: { batchId, type: { in: ["INGRESO", "AJUSTE_POSITIVO"] } },
    orderBy: { occurredAt: "asc" },
    select: { actorId: true },
  });
  return movement?.actorId ?? null;
}

export async function releaseBatch(input: {
  batchId: string;
  actorId: string;
  checklist: Checklist;
  thcPct?: number | null;
  cbdPct?: number | null;
  labName?: string | null;
  labDate?: string | null;
  labResult?: string | null;
  sampleRetainedG?: number | null;
  sampleUntil?: string | null;
  note?: string | null;
  noAnalysisAcknowledged?: boolean;
}) {
  const batch = await prisma.batch.findUnique({ where: { id: input.batchId } });
  if (!batch) throw badRequest("BATCH_NOT_FOUND", "El lote no existe.");
  if (batch.releasedAt) throw conflict("ALREADY_RELEASED", "El lote ya está liberado.");

  const harvestActorId = await harvestActorOf(batch.id);
  const hasAnalysis = input.thcPct != null || input.cbdPct != null || batch.thcPct != null || batch.cbdPct != null;
  const check = canRelease({
    stage: batch.stage,
    dryWeightG: batch.dryWeightG == null ? null : Number(batch.dryWeightG),
    actorId: input.actorId,
    harvestActorId,
    checklist: input.checklist,
    hasAnalysis,
    noAnalysisAcknowledged: input.noAnalysisAcknowledged,
  });
  if (!check.ok) throw badRequest(check.code, check.message);

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.batch.update({
      where: { id: batch.id },
      data: {
        releasedAt: now,
        releasedById: input.actorId,
        releaseNote: input.note?.trim() || null,
        stage: "DISPONIBLE",
        thcPct: input.thcPct == null ? undefined : input.thcPct,
        cbdPct: input.cbdPct == null ? undefined : input.cbdPct,
        labName: input.labName?.trim() || null,
        labDate: input.labDate ? new Date(`${input.labDate}T00:00:00.000Z`) : null,
        labResult: input.labResult?.trim() || null,
        sampleRetainedG: input.sampleRetainedG == null ? null : input.sampleRetainedG,
        sampleUntil: input.sampleUntil ? new Date(`${input.sampleUntil}T00:00:00.000Z`) : null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "BATCH_RELEASE",
        entity: "Batch",
        entityId: batch.id,
        payload: {
          checklist: input.checklist,
          sinAnalisis: !hasAnalysis,
          thcPct: input.thcPct ?? null,
          cbdPct: input.cbdPct ?? null,
          labResult: input.labResult ?? null,
          cosechaRegistradaPor: harvestActorId,
        } as object,
      },
    });
    return updated;
  });
}

/** Recall: retira el lote del mercado y deja registrado a quién hay que avisar. */
export async function recallBatch(input: { batchId: string; actorId: string; reason: string }) {
  const batch = await prisma.batch.findUnique({ where: { id: input.batchId } });
  if (!batch) throw badRequest("BATCH_NOT_FOUND", "El lote no existe.");
  if (batch.recalledAt) throw conflict("ALREADY_RECALLED", "El lote ya está retirado.");

  const affected = await prisma.dispensation.findMany({
    where: { batchId: batch.id, voidedAt: null },
    select: { memberId: true, grams: true },
  });
  const members = new Set(affected.map((a) => a.memberId));

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.batch.update({
      where: { id: batch.id },
      data: { stage: "RETIRADO", recalledAt: new Date(), recallReason: input.reason.trim() },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "BATCH_RECALL",
        entity: "Batch",
        entityId: batch.id,
        payload: { reason: input.reason.trim(), sociosAfectados: members.size } as object,
      },
    });
    return row;
  });

  return { batch: updated, affectedMembers: members.size };
}

/** Lotes retirados de los que este socio recibió algo (para el aviso del portal). */
export async function recalledBatchesForMember(memberId: string) {
  const rows = await prisma.dispensation.findMany({
    where: { memberId, voidedAt: null, batch: { recalledAt: { not: null } } },
    select: { grams: true, occurredAt: true, batch: { select: { code: true, recallReason: true, recalledAt: true, strain: { select: { name: true } } } } },
    orderBy: { occurredAt: "desc" },
  });
  return rows.map((r) => ({
    code: r.batch.code,
    strain: r.batch.strain.name,
    grams: Number(r.grams),
    occurredAt: r.occurredAt.toISOString(),
    reason: r.batch.recallReason,
    recalledAt: r.batch.recalledAt?.toISOString() ?? null,
  }));
}
