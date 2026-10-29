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

  return armarCatalogo(strains, new Map(saldos.map((r) => [r.strainId, Number(r.grams ?? 0)])));
}
