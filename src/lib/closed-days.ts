import type { Prisma } from "@prisma/client";

/** Un día cerrado no admite turnos ni reservas, aunque las franjas existan. */
export async function isClosedDay(tx: Prisma.TransactionClient | typeof import("./db").prisma, dayKey: string) {
  const found = await tx.closedDay.findUnique({ where: { date: new Date(`${dayKey}T00:00:00.000Z`) } });
  return Boolean(found);
}

export async function listClosedDays() {
  const { prisma } = await import("./db");
  return prisma.closedDay.findMany({ orderBy: { date: "asc" } });
}
