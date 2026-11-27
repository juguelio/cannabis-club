import { prisma } from "./db";
import { dayKeyOf } from "./appointments";
import type { Prisma } from "@prisma/client";

/**
 * Cuenta corriente del socio: cuotas sociales y aportes de cultivo.
 *
 * Reglas de dominio del club:
 * - Es un libro append-only. Corregir es contra-asiento (`reversalOfId`), nunca editar ni borrar.
 * - El saldo es la suma con signo de los asientos: CARGO suma deuda, PAGO la resta.
 * - Es prorrateo de costos, no precio: se habla de "aportes" y "cuotas", nunca de venta.
 */

export type EntryLike = { kind: "CARGO" | "PAGO"; amountArs: unknown };

/** Saldo deudor del socio. Positivo = debe; negativo = tiene saldo a favor. */
export function balanceOf(entries: EntryLike[]): number {
  const cents = entries.reduce((acc, e) => {
    const value = Math.round(Number(e.amountArs) * 100);
    return acc + (e.kind === "CARGO" ? value : -value);
  }, 0);
  return cents / 100;
}

/** Período `YYYY-MM` de una fecha, en la zona del club (misma clave de día que usa el resto). */
export function periodOf(date: Date = new Date(), offset = "-03:00"): string {
  return dayKeyOf(date, offset).slice(0, 7);
}

/** "2026-10" → "2026-11". */
export function nextPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) throw new Error(`Período inválido: ${period}`);
  const date = new Date(Date.UTC(year, month, 1));
  return date.toISOString().slice(0, 7);
}

export function isValidPeriod(period: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
}

type Tx = Prisma.TransactionClient | typeof prisma;

export async function memberBalance(memberId: string) {
  const sums = await prisma.accountEntry.groupBy({ by: ["kind"], where: { memberId }, _sum: { amountArs: true } });
  return balanceOf(sums.map(row => ({ kind: row.kind, amountArs: row._sum.amountArs })));
}

export async function memberAccount(memberId: string, take = 50, skip = 0) {
  const [entries, balance, count] = await Promise.all([
    prisma.accountEntry.findMany({
      where: { memberId },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take, skip,
      include: { creator: { select: { name: true } } },
    }),
    memberBalance(memberId),
    prisma.accountEntry.count({ where: { memberId } }),
  ]);
  return { entries, balance, count };
}

/** Aporte de cultivo de una entrega: convierte el estimado del portal en un cargo real. */
export async function chargeDispensation(
  tx: Tx,
  input: { memberId: string; dispensationId: string; grams: number; aportePorGramo: number; occurredAt?: Date },
) {
  if (!Number.isFinite(input.aportePorGramo) || input.aportePorGramo <= 0) return null;
  const exists = await tx.accountEntry.findUnique({ where: { dispensationId: input.dispensationId }, select: { id: true } });
  if (exists) return exists;
  const amountArs = Math.round(input.grams * input.aportePorGramo * 100) / 100;
  if (amountArs <= 0) return null;
  return tx.accountEntry.create({
    data: {
      memberId: input.memberId,
      kind: "CARGO",
      concept: "APORTE_CULTIVO",
      amountArs,
      dispensationId: input.dispensationId,
      occurredAt: input.occurredAt ?? new Date(),
      note: `${input.grams} g · aporte de cultivo`,
    },
    select: { id: true },
  });
}

/**
 * Genera la cuota social del período para los socios activos.
 * Idempotente: el índice único (socio, concepto, período) impide cobrarla dos veces.
 */
export async function chargeMonthlyFees(period: string, createdById?: string) {
  if (!isValidPeriod(period)) throw new Error(`Período inválido: ${period}`);
  const club = await prisma.club.findUnique({ where: { id: "singleton" }, select: { cuotaSocialArs: true } });
  const cuota = Number(club?.cuotaSocialArs ?? 0);
  if (!(cuota > 0)) return { created: 0, skipped: 0, cuota: 0, reason: "El club no tiene cuota social configurada." };

  const members = await prisma.member.findMany({ where: { status: "ACTIVO" }, select: { id: true } });
  const already = await prisma.accountEntry.findMany({
    where: { concept: "CUOTA_SOCIAL", period },
    select: { memberId: true },
  });
  const done = new Set(already.map((a) => a.memberId));
  const pending = members.filter((m) => !done.has(m.id));
  if (pending.length) {
    await prisma.accountEntry.createMany({
      data: pending.map((m) => ({
        memberId: m.id,
        kind: "CARGO" as const,
        concept: "CUOTA_SOCIAL" as const,
        amountArs: cuota,
        period,
        createdById: createdById ?? null,
        note: `Cuota social ${period}`,
      })),
      skipDuplicates: true,
    });
  }
  return { created: pending.length, skipped: done.size, cuota, reason: null };
}

export async function registerPayment(input: { memberId: string; amountArs: number; note?: string; createdById?: string }) {
  const amount = Math.round(input.amountArs * 100) / 100;
  if (!(amount > 0)) throw new Error("El importe del pago tiene que ser mayor a cero.");
  return prisma.accountEntry.create({
    data: {
      memberId: input.memberId,
      kind: "PAGO",
      concept: "AJUSTE",
      amountArs: amount,
      note: input.note?.trim() || "Pago recibido en el club",
      createdById: input.createdById ?? null,
    },
  });
}

/** Contra-asiento: el original queda marcado y el saldo se corrige con un asiento opuesto. */
export async function voidEntry(entryId: string, input: { reason: string; createdById?: string }) {
  const entry = await prisma.accountEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error("El asiento no existe.");
  if (entry.reversalOfId) throw new Error("Un contra-asiento no se anula: registrá otro movimiento.");
  const reversal = await prisma.accountEntry.findUnique({ where: { reversalOfId: entryId }, select: { id: true } });
  if (reversal) throw new Error("Ese asiento ya fue anulado.");

  return prisma.$transaction(async (tx) => {
    const contra = await tx.accountEntry.create({
      data: {
        memberId: entry.memberId,
        kind: entry.kind === "CARGO" ? "PAGO" : "CARGO",
        concept: "AJUSTE",
        amountArs: entry.amountArs,
        dispensationId: null,
        reversalOfId: entry.id,
        note: `Anulación: ${input.reason.trim()}`,
        createdById: input.createdById ?? null,
      },
    });
    await tx.accountEntry.update({ where: { id: entry.id }, data: { voidedAt: new Date() } });
    return contra;
  });
}

/** Totales del período para el cierre del día/mes: cargos, pagos y saldo pendiente de los socios. */
export async function periodSummary(period: string) {
  const entries = await prisma.accountEntry.findMany({
    where: { period, voidedAt: null },
    select: { kind: true, amountArs: true },
  });
  const cargos = entries.filter((e) => e.kind === "CARGO").reduce((a, e) => a + Number(e.amountArs), 0);
  const pagos = entries.filter((e) => e.kind === "PAGO").reduce((a, e) => a + Number(e.amountArs), 0);
  return { cargos: Math.round(cargos * 100) / 100, pagos: Math.round(pagos * 100) / 100, periodo: period };
}
