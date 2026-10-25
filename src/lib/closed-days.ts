import type { Prisma } from "@prisma/client";

/** Un día cerrado no admite turnos ni reservas, aunque las franjas existan. */
export async function isClosedDay(tx: Prisma.TransactionClient | typeof import("./db").prisma, dayKey: string) {
  const found = await tx.closedDay.findUnique({ where: { date: new Date(`${dayKey}T00:00:00.000Z`) } });
  return Boolean(found);
}

/** Claves (`YYYY-MM-DD`) de los días cerrados dentro de un horizonte, para filtrar grillas. */
export async function closedDayKeys(fromKey: string, horizonDays: number): Promise<Set<string>> {
  const { prisma } = await import("./db");
  const from = new Date(`${fromKey}T00:00:00.000Z`);
  const to = new Date(from.getTime() + horizonDays * 86_400_000);
  const rows = await prisma.closedDay.findMany({ where: { date: { gte: from, lt: to } }, select: { date: true } });
  return new Set(rows.map((r) => r.date.toISOString().slice(0, 10)));
}

export async function listClosedDays() {
  const { prisma } = await import("./db");
  return prisma.closedDay.findMany({ orderBy: { date: "asc" } });
}
