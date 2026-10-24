import { prisma } from "./db";

/**
 * Gramos retirados en el mes en curso (hora del club), por socio, en una consulta.
 * Igual que el tope (R02): cuenta la fecha de la ENTREGA y excluye las anuladas.
 */
export async function monthUsageByMember(memberIds: string[], timezone: string): Promise<Map<string, number>> {
  if (memberIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ memberId: string; grams: unknown }[]>`
    SELECT "memberId", SUM(grams) AS grams
    FROM "Dispensation"
    WHERE "memberId" = ANY(${memberIds})
      AND "voidedAt" IS NULL
      AND date_trunc('month', ("occurredAt" AT TIME ZONE ${timezone})) = date_trunc('month', (now() AT TIME ZONE ${timezone}))
    GROUP BY "memberId"
  `;
  return new Map(rows.map((r) => [r.memberId, Math.round(Number(r.grams) * 100) / 100]));
}
