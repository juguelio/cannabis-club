import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { clientIp, fail, json } from "@/lib/http";

const Body = z.object({
  code: z.string().min(2),
  strainId: z.string().min(1),
  originType: z.enum(["SEMILLA", "ESQUEJE", "COSECHA_PROPIA", "PROVEEDOR_EXTERNO"]).default("SEMILLA"),
  originProviderName: z.string().optional(),
  originProviderAddress: z.string().optional(),
  originReference: z.string().optional(),
  plantsCount: z.number().int().nonnegative().optional(),
  room: z.string().optional(),
  stage: z.enum(["PROPAGACION", "VEGETATIVO", "FLORACION", "COSECHA", "CURADO", "DISPONIBLE", "AGOTADO", "DESTRUIDO"]).default("PROPAGACION"),
  plantedAt: z.string().optional(),
  harvestedAt: z.string().optional(),
  wetWeightG: z.number().nonnegative().optional(),
  dryWeightG: z.number().nonnegative().optional(),
  thcPct: z.number().min(0).max(100).optional(),
  cbdPct: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    await requireUser();
    const batches = await prisma.batch.findMany({
      include: { strain: true, movements: { select: { type: true, grams: true } } },
      orderBy: { code: "desc" },
    });
    const rows = batches.map((b) => {
      const balance = b.movements.reduce(
        (a, m) =>
          a + (["INGRESO", "AJUSTE_POSITIVO", "DISPENSACION_REVERSA"].includes(m.type) ? 1 : -1) * Number(m.grams),
        0,
      );
      return {
        id: b.id,
        code: b.code,
        strain: b.strain.name,
        stage: b.stage,
        room: b.room,
        plantsCount: b.plantsCount,
        thcPct: b.thcPct,
        wetWeightG: b.wetWeightG,
        dryWeightG: b.dryWeightG,
        balanceG: Math.round(balance * 100) / 100,
      };
    });
    return json({ batches: rows });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(["ADMIN", "OPERADOR"]);
    const body = Body.parse(await req.json());
    const data = {
      ...body,
      plantedAt: body.plantedAt ? new Date(`${body.plantedAt}T00:00:00.000Z`) : null,
      harvestedAt: body.harvestedAt ? new Date(`${body.harvestedAt}T00:00:00.000Z`) : null,
      wetWeightG: body.wetWeightG == null ? null : new Prisma.Decimal(body.wetWeightG.toFixed(2)),
      dryWeightG: body.dryWeightG == null ? null : new Prisma.Decimal(body.dryWeightG.toFixed(2)),
      thcPct: body.thcPct == null ? null : new Prisma.Decimal(body.thcPct.toFixed(2)),
      cbdPct: body.cbdPct == null ? null : new Prisma.Decimal(body.cbdPct.toFixed(2)),
      originProviderName: body.originProviderName || null,
      originProviderAddress: body.originProviderAddress || null,
      originReference: body.originReference || null,
      room: body.room || null,
      notes: body.notes || null,
      plantsCount: body.plantsCount ?? null,
    };
    const batch = await prisma.batch.create({ data });
    // Cosecha en dos etapas: solo el peso seco acredita stock.
    if (body.dryWeightG && body.stage === "DISPONIBLE") {
      await prisma.stockMovement.create({
        data: {
          batchId: batch.id,
          type: "INGRESO",
          grams: new Prisma.Decimal(body.dryWeightG.toFixed(2)),
          actorId: user.id,
          reason: `Ingreso por cosecha seca ${batch.code}`,
        },
      });
    }
    await audit({ actorId: user.id, action: "BATCH_CREATE", entity: "Batch", entityId: batch.id, ip: clientIp(req), payload: { code: batch.code } });
    return json({ batch }, 201);
  } catch (error) {
    return fail(error);
  }
}
