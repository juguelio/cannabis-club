/**
 * Saldos de stock. El saldo NO es un campo: es la suma con signo del libro de movimientos.
 * Este módulo es el único que la calcula en bloque (una consulta agregada, no N filas en memoria).
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient | PrismaClient;

const POSITIVE = Prisma.sql`('INGRESO', 'AJUSTE_POSITIVO', 'DISPENSACION_REVERSA')`;

export type BatchTotals = {
  balanceG: number;
  ingresadoG: number;
  entregadoG: number;
  destruidoG: number;
  ajustesG: number;
  transferidoG: number;
};

const r2 = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;

/** Totales por lote. Si se pasa `batchIds`, sólo esos. */
export async function batchTotals(tx: Tx = prisma, batchIds?: string[]): Promise<Map<string, BatchTotals>> {
  if (batchIds && batchIds.length === 0) return new Map();
  const filter = batchIds ? Prisma.sql`WHERE "batchId" IN (${Prisma.join(batchIds)})` : Prisma.empty;
  const rows = await tx.$queryRaw<
    { batchId: string; balance: unknown; ingreso: unknown; entregado: unknown; destruido: unknown; ajustes: unknown; transferido: unknown }[]
  >`
    SELECT "batchId",
      SUM(CASE WHEN type IN ${POSITIVE} THEN grams ELSE -grams END) AS balance,
      SUM(CASE WHEN type IN ('INGRESO','AJUSTE_POSITIVO') THEN grams ELSE 0 END) AS ingreso,
      SUM(CASE WHEN type = 'DISPENSACION' THEN grams WHEN type = 'DISPENSACION_REVERSA' THEN -grams ELSE 0 END) AS entregado,
      SUM(CASE WHEN type = 'DESTRUCCION' THEN grams ELSE 0 END) AS destruido,
      SUM(CASE WHEN type = 'AJUSTE_NEGATIVO' THEN -grams WHEN type = 'AJUSTE_POSITIVO' THEN grams ELSE 0 END) AS ajustes,
      SUM(CASE WHEN type = 'TRANSFERENCIA' THEN grams ELSE 0 END) AS transferido
    FROM "StockMovement"
    ${filter}
    GROUP BY "batchId"
  `;
  return new Map(
    rows.map((r) => [
      r.batchId,
      {
        balanceG: r2(r.balance),
        ingresadoG: r2(r.ingreso),
        entregadoG: r2(r.entregado),
        destruidoG: r2(r.destruido),
        ajustesG: r2(r.ajustes),
        transferidoG: r2(r.transferido),
      },
    ]),
  );
}

const EMPTY: BatchTotals = { balanceG: 0, ingresadoG: 0, entregadoG: 0, destruidoG: 0, ajustesG: 0, transferidoG: 0 };
export const totalsOf = (map: Map<string, BatchTotals>, id: string) => map.get(id) ?? EMPTY;

/** Lotes con su cepa y sus totales, en una sola pasada. */
export async function batchesWithTotals(where: Prisma.BatchWhereInput = {}) {
  const batches = await prisma.batch.findMany({ where, include: { strain: true }, orderBy: { code: "desc" } });
  const totals = await batchTotals(prisma, batches.map((b) => b.id));
  return batches.map((b) => ({ ...b, totals: totalsOf(totals, b.id) }));
}

/** Stock disponible para entregar: suma de saldos de lotes en etapa DISPONIBLE. */
export async function availableStock(tx: Tx = prisma): Promise<number> {
  const rows = await tx.$queryRaw<{ balance: unknown }[]>`
    SELECT COALESCE(SUM(CASE WHEN m.type IN ${POSITIVE} THEN m.grams ELSE -m.grams END), 0) AS balance
    FROM "StockMovement" m JOIN "Batch" b ON b.id = m."batchId"
    WHERE b.stage = 'DISPONIBLE'
  `;
  return r2(rows[0]?.balance);
}
