import { prisma } from "./db";

/** Gramos netos retirados en el mes en curso (hora del club), por socio, en una consulta. */
export async function monthUsageByMember(memberIds: string[], timezone: string): Promise<Map<string, number>> {
  if (memberIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ memberId: string; grams: unknown }[]>`
    SELECT "memberId",
      SUM(CASE WHEN type = 'DISPENSACION' THEN grams ELSE -grams END) AS grams
    FROM "StockMovement"
    WHERE "memberId" = ANY(${memberIds})
      AND type IN ('DISPENSACION', 'DISPENSACION_REVERSA')
      AND date_trunc('month', ("occurredAt" AT TIME ZONE ${timezone})) = date_trunc('month', (now() AT TIME ZONE ${timezone}))
    GROUP BY "memberId"
  `;
  return new Map(rows.map((r) => [r.memberId, Math.round(Number(r.grams) * 100) / 100]));
}
