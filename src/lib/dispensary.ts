import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { getClub, limitsFromClub } from "./club";
import { conflict, notFound, unprocessable } from "./errors";
import { evaluateDispensation, type Usage } from "./limits";

type Tx = Prisma.TransactionClient | PrismaClient;

/** Uso del socio en el día y el mes locales del club, neto de reversas. */
export async function memberUsage(tx: Tx, memberId: string, timezone: string): Promise<Usage> {
  return memberUsageAt(tx, memberId, timezone, new Date());
}

/** Uso del día y del mes de una fecha dada (para reservar a futuro, no con el consumo de hoy). */
export async function memberUsageAt(tx: Tx, memberId: string, timezone: string, at: Date): Promise<Usage> {
  // El uso del período se mide por la fecha de la ENTREGA, no por la del asiento.
  // Restar la reversa por su propia fecha hacía que anular ayer una entrega de ayer
  // dejara el uso de hoy en negativo y regalara cupo (R02 del REA de operación).
  // Una entrega anulada deja de contar en su período; el stock sigue por movimientos.
  const rows = await tx.$queryRaw<{ day: unknown; month: unknown }[]>`
    SELECT
      COALESCE(SUM(CASE WHEN (("occurredAt" AT TIME ZONE ${timezone})::date
        = (${at}::timestamptz AT TIME ZONE ${timezone})::date) AND "voidedAt" IS NULL THEN grams ELSE 0 END), 0) AS day,
      COALESCE(SUM(CASE WHEN date_trunc('month', ("occurredAt" AT TIME ZONE ${timezone}))
        = date_trunc('month', (${at}::timestamptz AT TIME ZONE ${timezone})) AND "voidedAt" IS NULL THEN grams ELSE 0 END), 0) AS month
    FROM "Dispensation"
    WHERE "memberId" = ${memberId}
  `;
  const r = rows[0];
  return { dayGrams: Number(r?.day ?? 0), monthGrams: Number(r?.month ?? 0) };
}

export async function batchBalance(tx: Tx, batchId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ balance: unknown }[]>`
    SELECT COALESCE(SUM(CASE WHEN type IN ('INGRESO', 'AJUSTE_POSITIVO', 'DISPENSACION_REVERSA')
      THEN grams ELSE -grams END), 0) AS balance
    FROM "StockMovement"
    WHERE "batchId" = ${batchId}
  `;
  return Math.round(Number(rows[0]?.balance ?? 0) * 100) / 100;
}

export type DispenseInput = {
  memberId: string;
  batchId: string;
  grams: number;
  signatureType?: "REGISTRO_OPERADOR" | "PIN" | "FIRMA_DIGITAL" | "QR";
  /** Reserva que se está atendiendo, si el mostrador abrió el caso desde el portal. */
  pickupId?: string;
  signatureRef?: string | null;
  notes?: string | null;
  operatorId: string;
  ip?: string | null;
};

/**
 * Entrega a socio. Todo el chequeo y la escritura ocurren en una transacción Serializable:
 * dos entregas simultáneas no pueden pasarse del tope ni dejar el lote en negativo.
 */
export async function dispense(input: DispenseInput) {
  const club = await getClub();
  const config = limitsFromClub(club);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const member = await tx.member.findUnique({ where: { id: input.memberId } });
        if (!member) throw notFound("Socio inexistente");

        const batch = await tx.batch.findUnique({ where: { id: input.batchId } });
        if (!batch) throw notFound("Lote inexistente");
        if (batch.stage !== "DISPONIBLE")
          throw conflict("BATCH_NOT_AVAILABLE", `El lote ${batch.code} está en etapa ${batch.stage}, no disponible.`);

        const usage = await memberUsage(tx, member.id, club.timezone);
        const decision = evaluateDispensation({
          member: {
            status: member.status,
            birthDate: member.birthDate,
            reprocannStatus: member.reprocannStatus,
            reprocannExpiresAt: member.reprocannExpiresAt,
            monthlyForecastG: member.monthlyForecastG == null ? null : Number(member.monthlyForecastG),
          },
          usage,
          config,
          grams: input.grams,
          thcPct: batch.thcPct == null ? null : Number(batch.thcPct),
        });

        if (!decision.ok) throw unprocessable(decision.code, decision.message, decision.snapshot);

        const available = await batchBalance(tx, batch.id);
        if (available + 1e-9 < input.grams)
          throw conflict("STOCK_INSUFFICIENT", `El lote ${batch.code} tiene ${available} g disponibles.`);

        const dispensation = await tx.dispensation.create({
          data: {
            memberId: member.id,
            batchId: batch.id,
            grams: new Prisma.Decimal(input.grams.toFixed(2)),
            thcPct: batch.thcPct,
            operatorId: input.operatorId,
            signatureType: input.signatureType ?? "REGISTRO_OPERADOR",
            signatureRef: input.signatureRef ?? null,
            notes: input.notes ?? null,
            limitSnapshot: decision.snapshot as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.stockMovement.create({
          data: {
            batchId: batch.id,
            type: "DISPENSACION",
            grams: new Prisma.Decimal(input.grams.toFixed(2)),
            memberId: member.id,
            actorId: input.operatorId,
            dispensationId: dispensation.id,
            reason: `Entrega a socio ${member.legajo}`,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: input.operatorId,
            action: "DISPENSATION_CREATE",
            entity: "Dispensation",
            entityId: dispensation.id,
            ip: input.ip ?? null,
            payload: {
              memberId: member.id,
              batchId: batch.id,
              grams: input.grams,
              code: decision.code,
            } as Prisma.InputJsonValue,
          },
        });

        // La reserva se cierra SÓLO si el mostrador vino con ese contexto (pickupId).
        // Antes se tomaba la más antigua del socio: una entrega de 5 g podía cerrar una reserva
        // de 20 g o una de otro día (R01 del REA de operación).
        const pickup = input.pickupId
          ? await tx.pickupRequest.findUnique({ where: { id: input.pickupId } })
          : null;
        if (input.pickupId && !pickup) throw notFound("Reserva inexistente");
        if (pickup) {
          if (pickup.memberId !== member.id) throw conflict("PICKUP_MISMATCH", "La reserva es de otro socio.");
          if (!["SOLICITADA", "CONFIRMADA"].includes(pickup.status))
            throw conflict("PICKUP_NOT_OPEN", "Esa reserva ya está cerrada.");
        }
        if (pickup) {
          await tx.pickupRequest.update({
            where: { id: pickup.id },
            data: { status: "RETIRADA", fulfilledAt: new Date(), dispensationId: dispensation.id },
          });
          const reservado = Number(pickup.grams);
          if (Math.abs(reservado - input.grams) > 0.001) {
            await tx.auditLog.create({
              data: {
                actorId: input.operatorId,
                action: "PICKUP_PARTIAL",
                entity: "PickupRequest",
                entityId: pickup.id,
                payload: { reservadoG: reservado, entregadoG: input.grams, differenceG: Math.round((input.grams - reservado) * 100) / 100 },
              },
            });
          }
          if (pickup.appointmentId) {
            await tx.appointment.update({
              where: { id: pickup.appointmentId },
              data: { status: "ATENDIDO", attendedAt: new Date(), dispensationId: dispensation.id },
            });
          }
        }

        return {
          dispensation,
          decision,
          availableAfter: Math.round((available - input.grams) * 100) / 100,
          pickupFulfilled: pickup?.id ?? null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AppError") throw error;
    throw error;
  }
}

/** Anular una entrega = contra-asiento. El asiento original nunca se borra. */
export async function voidDispensation(input: {
  dispensationId: string;
  actorId: string;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const dispensation = await tx.dispensation.findUnique({
      where: { id: input.dispensationId },
      include: { movement: true },
    });
    if (!dispensation) throw notFound("Entrega inexistente");
    if (dispensation.voidedAt) throw conflict("ALREADY_VOIDED", "La entrega ya está anulada.");
    if (!dispensation.movement) throw conflict("NO_MOVEMENT", "La entrega no tiene asiento asociado.");

    await tx.stockMovement.create({
      data: {
        batchId: dispensation.batchId,
        type: "DISPENSACION_REVERSA",
        grams: dispensation.grams,
        memberId: dispensation.memberId,
        actorId: input.actorId,
        reason: input.reason,
        reversalOfId: dispensation.movement.id,
      },
    });

    const updated = await tx.dispensation.update({
      where: { id: dispensation.id },
      data: { voidedAt: new Date(), voidedById: input.actorId, voidReason: input.reason },
    });

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "DISPENSATION_VOID",
        entity: "Dispensation",
        entityId: dispensation.id,
        payload: { reason: input.reason } as Prisma.InputJsonValue,
      },
    });

    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
