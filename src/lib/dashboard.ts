/**
 * Datos del panel en un solo lugar: el día del club (hora local), sin cálculos repetidos en la página.
 */
import { prisma } from "./db";
import { getClub } from "./club";
import { availableStock, batchesWithTotals } from "./stock";
import { addDaysKey, dayKeyOf, labelOf, slotInstant } from "./appointments";

export type DayPoint = { day: string; grams: number; count: number };

export async function dashboardData(now = new Date()) {
  const club = await getClub();
  const tz = club.timezone;
  const today = dayKeyOf(now);
  const in30 = new Date(now.getTime() + 30 * 86_400_000);

  const [counts, blocked, expiring, stockG, lots, series, todayAppts, pickups, latest] = await Promise.all([
    prisma.member.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.member.findMany({
      where: { status: "ACTIVO", OR: [{ reprocannStatus: { not: "VIGENTE" } }, { reprocannExpiresAt: { lt: now } }] },
      orderBy: { lastName: "asc" },
      take: 20,
    }),
    prisma.member.findMany({
      where: { status: "ACTIVO", reprocannStatus: "VIGENTE", reprocannExpiresAt: { gte: now, lte: in30 } },
      orderBy: { reprocannExpiresAt: "asc" },
      take: 20,
    }),
    availableStock(),
    batchesWithTotals({ stage: { in: ["DISPONIBLE", "CURADO", "COSECHA", "FLORACION", "VEGETATIVO", "PROPAGACION"] } }),
    prisma.$queryRaw<{ day: Date; grams: unknown; count: bigint }[]>`
      WITH days AS (
        SELECT generate_series((now() AT TIME ZONE ${tz})::date - 13, (now() AT TIME ZONE ${tz})::date, interval '1 day')::date AS day
      )
      SELECT d.day, COALESCE(SUM(x.grams), 0) AS grams, COUNT(x.id) AS count
      FROM days d
      LEFT JOIN "Dispensation" x
        ON (x."occurredAt" AT TIME ZONE ${tz})::date = d.day AND x."voidedAt" IS NULL
      GROUP BY d.day ORDER BY d.day`,
    prisma.appointment.findMany({
      where: { scheduledAt: { gte: slotInstant(today, 0), lt: slotInstant(addDaysKey(today, 1), 0) }, status: { not: "CANCELADO" } },
      include: { member: { select: { id: true, legajo: true, firstName: true, lastName: true } }, pickup: { select: { grams: true, status: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.pickupRequest.count({ where: { status: { in: ["SOLICITADA", "CONFIRMADA"] } } }),
    prisma.dispensation.findMany({
      take: 6,
      orderBy: { occurredAt: "desc" },
      include: { member: { select: { id: true, firstName: true, lastName: true, legajo: true } }, batch: { include: { strain: true } }, operator: { select: { name: true } } },
    }),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>;
  const points: DayPoint[] = series.map((r) => ({
    day: new Date(r.day).toISOString().slice(0, 10),
    grams: Math.round(Number(r.grams) * 100) / 100,
    count: Number(r.count),
  }));
  const todayPoint = points[points.length - 1] ?? { day: today, grams: 0, count: 0 };
  const week = points.slice(-7).reduce((a, p) => a + p.grams, 0);
  const prevWeek = points.slice(0, 7).reduce((a, p) => a + p.grams, 0);

  // Un lote sin saldo no está disponible para entregar, aunque la etapa lo diga (R09).
  const available = lots.filter((b) => b.stage === "DISPONIBLE" && b.totals.balanceG > 0);
  const lowStock = available
    .map((b) => ({ id: b.id, code: b.code, strain: b.strain.name, balanceG: b.totals.balanceG, dryG: Number(b.dryWeightG ?? 0) }))
    .filter((b) => b.balanceG < Math.max(30, b.dryG * 0.15));
  const growing = lots.filter((b) => b.stage !== "DISPONIBLE").map((b) => ({ id: b.id, code: b.code, strain: b.strain.name, stage: b.stage }));

  return {
    club,
    today,
    members: {
      active: byStatus.ACTIVO ?? 0,
      pending: byStatus.PENDIENTE ?? 0,
      suspended: byStatus.SUSPENDIDO ?? 0,
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
    },
    blocked,
    expiring,
    stockG,
    available: available.map((b) => ({ id: b.id, code: b.code, strain: b.strain.name, room: b.room, thcPct: b.thcPct == null ? null : Number(b.thcPct), balanceG: b.totals.balanceG, dryG: Number(b.dryWeightG ?? 0) })),
    lowStock,
    growing,
    series: points,
    todayPoint,
    week: Math.round(week * 100) / 100,
    prevWeek: Math.round(prevWeek * 100) / 100,
    agenda: todayAppts.map((a) => ({
      id: a.id,
      time: labelOf(a.scheduledAt),
      at: a.scheduledAt.toISOString(),
      status: a.status,
      memberId: a.member.id,
      legajo: a.member.legajo,
      name: `${a.member.firstName} ${a.member.lastName}`,
      pickupG: a.pickup && ["SOLICITADA", "CONFIRMADA"].includes(a.pickup.status) ? Number(a.pickup.grams) : null,
    })),
    pickups,
    latest,
  };
}
