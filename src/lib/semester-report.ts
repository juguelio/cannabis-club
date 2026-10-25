import { prisma } from "./db";
import { getClub } from "./club";
import { hashPayload } from "./monthly-close";
import { conflict } from "./errors";
import type { Prisma } from "@prisma/client";
import { buildSemesterPayload, semesterBounds, type CultivationBatch } from "./semester-rules";

/**
 * Informe semestral en carácter de declaración jurada (Res. 1780/2025).
 *
 * Lo que la norma pide y la app puede contestar con datos propios: **plantas totales y en floración**
 * al cierre, **variedad genética** de cada lote en cultivo y la actividad del período (cosechado,
 * dispensado, lotes retirados). Es un **libro**: se firma, se congela con huella SHA-256 del JSON
 * canónico y no se edita; corregirlo es otro informe con `supersedesId`.
 */

const STAGES_IN_CULTIVO = ["PROPAGACION", "VEGETATIVO", "FLORACION"] as const;

/** Datos del semestre tal como están en la base, listos para firmar. */
export async function semesterPayload(period: string, closedAt = new Date()) {
  const { start, end } = semesterBounds(period);
  const club = await getClub();

  const [batchesInCultivo, harvested, strains, dispensations, recalled] = await Promise.all([
    prisma.batch.findMany({
      where: { stage: { in: [...STAGES_IN_CULTIVO] } },
      select: { code: true, room: true, stage: true, plantsCount: true, plantedAt: true, harvestedAt: true, dryWeightG: true, strain: { select: { name: true, genetics: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.batch.findMany({ where: { harvestedAt: { gte: start, lt: end } }, select: { dryWeightG: true } }),
    prisma.strain.findMany({ select: { name: true, genetics: true, active: true }, orderBy: { name: "asc" } }),
    prisma.dispensation.findMany({ where: { occurredAt: { gte: start, lt: end }, voidedAt: null }, select: { grams: true } }),
    prisma.batch.count({ where: { recalledAt: { gte: start, lt: end } } }),
  ]);

  const cultivation: CultivationBatch[] = batchesInCultivo.map((b) => ({
    code: b.code,
    strain: b.strain.name,
    genetics: b.strain.genetics,
    room: b.room,
    stage: b.stage,
    plants: b.plantsCount ?? 0,
    plantedAt: b.plantedAt,
    harvestedAt: b.harvestedAt,
    dryWeightG: Number(b.dryWeightG ?? 0),
  }));

  return buildSemesterPayload({
    period,
    closedAt,
    club: {
      nombre: club.nombre,
      cuit: club.cuit,
      reprocannNumber: club.reprocannNumber,
      directorMedico: club.directorMedico,
      responsableTecnico: club.responsableTecnico,
    },
    cultivation,
    varieties: strains,
    harvestedGrams: harvested.reduce((acc, b) => acc + Number(b.dryWeightG ?? 0), 0),
    dispensedGrams: dispensations.reduce((acc, d) => acc + Number(d.grams), 0),
    dispensations: dispensations.length,
    recalledBatches: recalled,
  });
}

/** Firmar congela: el mismo período no se vuelve a firmar salvo que declare qué reemplaza. */
export async function signSemesterReport(input: { period: string; actorId: string; note?: string | null; supersedesId?: string | null }) {
  const existing = await prisma.semesterReport.findUnique({ where: { period: input.period } });
  if (existing && !input.supersedesId) throw conflict("ALREADY_SIGNED", `El semestre ${input.period} ya tiene un informe firmado.`);
  const payload = await semesterPayload(input.period);
  const hash = hashPayload(payload);
  return prisma.$transaction(async (tx) => {
    const row = await tx.semesterReport.create({
      data: {
        period: input.period,
        payload: payload as unknown as Prisma.InputJsonValue,
        hash,
        signedById: input.actorId,
        note: input.note?.trim() || null,
        supersedesId: input.supersedesId ?? null,
      },
    });
    await tx.auditLog.create({
      data: { actorId: input.actorId, action: "SEMESTER_REPORT", entity: "SemesterReport", entityId: row.id, payload: { period: input.period, hash } as object },
    });
    return row;
  });
}

export async function signedSemesterReport(period: string) {
  return prisma.semesterReport.findUnique({ where: { period }, include: { signer: { select: { name: true } } } });
}

export async function listSemesterReports() {
  return prisma.semesterReport.findMany({ include: { signer: { select: { name: true } } }, orderBy: { signedAt: "desc" }, take: 24 });
}

/** ¿El contenido guardado sigue coincidiendo con la huella firmada? */
export function semesterIntegrity(payload: unknown, hash: string): boolean {
  return hashPayload(payload) === hash;
}

export { isSemesterPeriod, semesterBounds, semesterCsv, semesterOf } from "./semester-rules";
export type { CultivationBatch, SemesterInput, SemesterPayload } from "./semester-rules";
