import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { batchTotals, totalsOf } from "@/lib/stock";

export const contextoLote = cache(async (id: string) => {
  const session = await getSession();
  if (!session) redirect("/login");
  const [batch, saldos] = await Promise.all([
    prisma.batch.findUnique({ where: { id }, include: { strain: { select: { name: true, genetics: true } } } }),
    batchTotals(prisma, [id]),
  ]);
  if (!batch) notFound();
  return { session, batch, t: totalsOf(saldos, id) };
});
