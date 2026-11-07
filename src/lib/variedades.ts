import { prisma } from "@/lib/db";
import { armarCatalogo, type Variedad } from "@/lib/variedad-rules";

export type { Variedad };

/** Catálogo del club: variedades activas con su stock disponible (sin precios). */
export async function catalogoDelClub(): Promise<Variedad[]> {
  const [strains, saldos] = await Promise.all([
    prisma.strain.findMany({
      select: { id: true, name: true, genetics: true, thcPct: true, cbdPct: true, active: true, fotoVersion: true },
      orderBy: { name: "asc" },
    }),
    prisma.$queryRaw<{ strainId: string; grams: unknown }[]>`
      SELECT b."strainId" AS "strainId",
        SUM(CASE WHEN m.type IN ('INGRESO','AJUSTE_POSITIVO','DISPENSACION_REVERSA') THEN m.grams ELSE -m.grams END) AS grams
      FROM "StockMovement" m JOIN "Batch" b ON b.id = m."batchId"
      WHERE b.stage = 'DISPONIBLE'
      GROUP BY b."strainId"
    `,
  ]);

  // El lote que se entrega hoy: el más reciente de los disponibles de esa cepa.
  const lotes = await prisma.batch.findMany({
    where: { stage: "DISPONIBLE" },
    select: { strainId: true, code: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const lotePorCepa = new Map<string, string>();
  for (const b of lotes) if (!lotePorCepa.has(b.strainId)) lotePorCepa.set(b.strainId, b.code);

  return armarCatalogo(
    strains,
    new Map(saldos.map((r) => [r.strainId, Number(r.grams ?? 0)])),
    lotePorCepa,
  );
}
