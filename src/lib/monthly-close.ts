import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getClub } from "./club";
import { periodOf } from "./account";
import { MOVEMENT_SIGN } from "./limits";
import { conflict, badRequest } from "./errors";

/**
 * Cierre mensual firmado (REA 3, patrón Uruguay): los totales del período se congelan
 * con la firma de quien cierra y una huella del contenido.
 *
 * - Es append-only: un cierre firmado no se edita. Corregirlo es otro cierre que declara
 *   cuál reemplaza (`supersedesId`).
 * - La huella (SHA-256 del JSON canónico) permite detectar si alguien tocó el payload.
 */

const r2 = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;

/** JSON con claves ordenadas: la misma información produce siempre la misma huella. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function hashPayload(payload: unknown): string {
  return crypto.createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

/** Límites del período en la zona del club (-03:00). */
export function periodBounds(period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw badRequest("INVALID_PERIOD", "El período tiene que ser AAAA-MM.");
  const [year, month] = period.split("-").map(Number);
  const start = new Date(`${period}-01T00:00:00.000-03:00`);
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const end = new Date(`${nextMonth.toISOString().slice(0, 7)}-01T00:00:00.000-03:00`);
  return { start, end };
}

export type ClosePayload = Awaited<ReturnType<typeof monthlyTotals>>;

/** Totales del período. Todo sale de los libros: no hay números escritos a mano. */
export async function monthlyTotals(period: string) {
  const { start, end } = periodBounds(period);
  const club = await getClub();

  const [dispensations, voided, movements, batches, members, closes, account, recalls] = await Promise.all([
    prisma.dispensation.findMany({
      where: { occurredAt: { gte: start, lt: end } },
      select: { grams: true, voidedAt: true, memberId: true, batchId: true },
    }),
    prisma.dispensation.count({ where: { voidedAt: { gte: start, lt: end } } }),
    prisma.stockMovement.findMany({ where: { occurredAt: { lt: end } }, select: { type: true, grams: true, occurredAt: true } }),
    prisma.batch.findMany({
      where: { OR: [{ harvestedAt: { gte: start, lt: end } }, { releasedAt: { gte: start, lt: end } }, { recalledAt: { gte: start, lt: end } }] },
      select: { dryWeightG: true, harvestedAt: true, releasedAt: true, recalledAt: true },
    }),
    prisma.member.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.monthlyClose.findMany({ where: { signedAt: { gte: start, lt: end } }, select: { id: true, period: true } }),
    prisma.accountEntry.findMany({ where: { occurredAt: { gte: start, lt: end } }, select: { kind: true, amountArs: true } }),
    prisma.batch.count({ where: { recalledAt: { gte: start, lt: end } } }),
  ]);

  const vivas = dispensations.filter((d) => !d.voidedAt);
  const gramosEntregados = r2(vivas.reduce((a, d) => a + Number(d.grams), 0));
  const gramosAnulados = r2(dispensations.filter((d) => d.voidedAt).reduce((a, d) => a + Number(d.grams), 0));

  const stockAlCierre = r2(
    movements
      .filter((m) => m.occurredAt < end)
      .reduce((acc, m) => acc + (MOVEMENT_SIGN[m.type] ?? 0) * Number(m.grams), 0),
  );
  const destruidoG = r2(
    movements.filter((m) => m.type === "DESTRUCCION" && m.occurredAt >= start && m.occurredAt < end).reduce((a, m) => a + Number(m.grams), 0),
  );
  const cosechadoG = r2(
    batches.filter((b) => b.harvestedAt && b.harvestedAt >= start && b.harvestedAt < end).reduce((a, b) => a + Number(b.dryWeightG ?? 0), 0),
  );
  const cargos = r2(account.filter((a) => a.kind === "CARGO").reduce((s, a) => s + Number(a.amountArs), 0));
  const pagos = r2(account.filter((a) => a.kind === "PAGO").reduce((s, a) => s + Number(a.amountArs), 0));

  const socios: Record<string, number> = {};
  for (const row of members) socios[row.status] = row._count._all;

  return {
    periodo: period,
    club: {
      nombre: club.nombre,
      cuit: club.cuit ?? null,
      directorMedico: club.directorMedico ?? null,
      responsableTecnico: club.responsableTecnico ?? null,
    },
    topes: {
      diarioG: Number(club.limitePorPedidoG),
      mensualG: Number(club.limiteMensualG),
      menorG: Number(club.limiteMenorG),
      thcMaxMenor: club.thcMaxMenor == null ? null : Number(club.thcMaxMenor),
      requiereLiberacion: club.requiereLiberacion,
    },
    socios,
    entregas: {
      cantidad: vivas.length,
      gramos: gramosEntregados,
      sociosDistintos: new Set(vivas.map((d) => d.memberId)).size,
      lotesDistintos: new Set(vivas.map((d) => d.batchId)).size,
    },
    anulaciones: { cantidad: voided, gramos: gramosAnulados },
    stockAlCierreG: stockAlCierre,
    cosechadoG,
    destruidoG,
    cuenta: { cargos, pagos, saldo: r2(cargos - pagos) },
    calidad: {
      lotesLiberados: batches.filter((b) => b.releasedAt && b.releasedAt >= start && b.releasedAt < end).length,
      recalls: recalls,
    },
    cierresFirmadosEnElPeriodo: closes.length,
    generadoEl: new Date().toISOString(),
  };
}

export async function signClose(input: { period: string; actorId: string; note?: string | null }) {
  const existing = await prisma.monthlyClose.findUnique({ where: { period: input.period } });
  if (existing) throw conflict("ALREADY_CLOSED", `El período ${input.period} ya tiene un cierre firmado.`);
  const payload = await monthlyTotals(input.period);
  const hash = hashPayload(payload);
  const close = await prisma.$transaction(async (tx) => {
    const row = await tx.monthlyClose.create({
      data: { period: input.period, payload: payload as unknown as Prisma.InputJsonValue, hash, signedById: input.actorId, note: input.note?.trim() || null },
    });
    await tx.auditLog.create({
      data: { actorId: input.actorId, action: "MONTHLY_CLOSE", entity: "MonthlyClose", entityId: row.id, payload: { period: input.period, hash } as object },
    });
    return row;
  });
  return close;
}

export async function listCloses(take = 12) {
  return prisma.monthlyClose.findMany({ orderBy: { period: "desc" }, take, include: { signer: { select: { name: true } } } });
}

export async function closeOf(period: string) {
  return prisma.monthlyClose.findUnique({ where: { period }, include: { signer: { select: { name: true } } } });
}

/** Verifica que el contenido firmado siga siendo el que se firmó. */
export function integrity(close: { payload: unknown; hash: string }) {
  const current = hashPayload(close.payload);
  return { ok: current === close.hash, current };
}

/** El mes en curso, para el selector por defecto. */
export const currentPeriod = () => periodOf(new Date());
