import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { getClub, limitsFromClub } from "./club";
import { chargeDispensation } from "./account";
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
  /** Clave del intento: si se repite (reintento, doble clic, red caída), devuelve la entrega ya hecha. */
  idempotencyKey?: string;
  signatureRef?: string | null;
  notes?: string | null;
  operatorId: string;
  ip?: string | null;
  /** El operador confirmó que es otra entrega: misma cantidad, socio y lote hace menos de un minuto, con otra clave. */
  confirmDuplicate?: boolean;
};

/** Ventana en la que una entrega idéntica se considera doble registro. */
export const DUPLICATE_WINDOW_MS = 60_000;

/**
 * Entrega a socio. Todo el chequeo y la escritura ocurren en una transacción Serializable:
 * dos entregas simultáneas no pueden pasarse del tope ni dejar el lote en negativo.
 */
export async function dispense(input: DispenseInput) {
  const club = await getClub();
  const config = limitsFromClub(club);

  // Reintento de la misma intención: se devuelve lo ya registrado, sin asiento nuevo.
  if (input.idempotencyKey) {
    const previa = await prisma.dispensation.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (previa) return { dispensation: previa, replay: true as const, availableAfter: null, pickupFulfilled: null };
  }

  // Un conflicto de serialización no es un error para el operador: si la intención trae clave,
  // se reintenta y, si la otra transacción ya la registró, se devuelve esa misma entrega.
  for (let intento = 0; ; intento += 1) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const member = await tx.member.findUnique({ where: { id: input.memberId } });
        if (!member) throw notFound("Socio inexistente");

        const batch = await tx.batch.findUnique({ where: { id: input.batchId } });
        if (!batch) throw notFound("Lote inexistente");
        if (batch.recalledAt || batch.stage === "RETIRADO")
          throw conflict("BATCH_RECALLED", `El lote ${batch.code} fue retirado del mercado.`);
        if (batch.stage !== "DISPONIBLE")
          throw conflict("BATCH_NOT_AVAILABLE", `El lote ${batch.code} está en etapa ${batch.stage}, no disponible.`);
        // Nada sale sin que alguien haya firmado que el lote está apto (REA 5.1).
        if (club.requiereLiberacion && !batch.releasedAt)
          throw conflict("BATCH_NOT_RELEASED", `El lote ${batch.code} todavía no está liberado: falta la firma de calidad.`);

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

        if (!input.confirmDuplicate) {
          const twin = await tx.dispensation.findFirst({
            where: {
              memberId: member.id,
              batchId: batch.id,
              grams: new Prisma.Decimal(input.grams.toFixed(2)),
              voidedAt: null,
              occurredAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
            },
            select: { id: true, occurredAt: true },
          });
          if (twin)
            throw conflict(
              "DUPLICATE_SUSPECTED",
              `Hace menos de un minuto se registró la misma entrega (${input.grams} g del lote ${batch.code}). Si es otra entrega, confirmala de nuevo.`,
              { dispensationId: twin.id },
            );
        }

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
            idempotencyKey: input.idempotencyKey ?? null,
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

        // El aporte de cultivo deja de ser una estimación del portal: queda como cargo en la cuenta del socio.
        await chargeDispensation(tx, {
          memberId: member.id,
          dispensationId: dispensation.id,
          grams: input.grams,
          aportePorGramo: Number(club.aportePorGramo ?? 0),
          occurredAt: dispensation.occurredAt,
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

        // Lote vacío: deja de ofrecerse en el mostrador sin que nadie tenga que acordarse.
        const after = Math.round((available - input.grams) * 100) / 100;
        if (after <= 0) await tx.batch.update({ where: { id: batch.id }, data: { stage: "AGOTADO" } });

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
          availableAfter: after,
          batchExhausted: after <= 0,
          pickupFulfilled: pickup?.id ?? null,
          replay: false as const,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AppError") throw error;
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
    // Misma clave: índice único (P2002) o choque de serialización (P2034).
    if (input.idempotencyKey && (code === "P2002" || code === "P2034")) {
      const previa = await prisma.dispensation.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (previa) return { dispensation: previa, replay: true as const, availableAfter: null, pickupFulfilled: null };
      if (code === "P2034" && intento < 2) {
        await new Promise((r) => setTimeout(r, 60 * (intento + 1)));
        continue;
      }
    }
    // Sin clave de intento: dos entregas simultáneas chocan y Postgres aborta una (P2034).
    if (code === "P2034")
      throw conflict("CONCURRENT_UPDATE", "Otra entrega se registró al mismo tiempo. Revisá el saldo y volvé a confirmar.");
    throw error;
  }
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

    // El cargo del aporte de cultivo también se revierte, con contra-asiento (no se borra).
    const cargo = await tx.accountEntry.findUnique({ where: { dispensationId: dispensation.id } });
    if (cargo && !cargo.voidedAt) {
      const reversal = await tx.accountEntry.findUnique({ where: { reversalOfId: cargo.id }, select: { id: true } });
      if (!reversal) {
        await tx.accountEntry.create({
          data: {
            memberId: cargo.memberId,
            kind: cargo.kind === "CARGO" ? "PAGO" : "CARGO",
            concept: "AJUSTE",
            amountArs: cargo.amountArs,
            reversalOfId: cargo.id,
            note: `Anulación de la entrega: ${input.reason}`,
            createdById: input.actorId,
          },
        });
        await tx.accountEntry.update({ where: { id: cargo.id }, data: { voidedAt: new Date() } });
      }
    }

    // El contra-asiento devuelve gramos: un lote que se había agotado vuelve a estar disponible.
    const batch = await tx.batch.findUnique({ where: { id: dispensation.batchId }, select: { stage: true } });
    if (batch?.stage === "AGOTADO" && (await batchBalance(tx, dispensation.batchId)) > 0)
      await tx.batch.update({ where: { id: dispensation.batchId }, data: { stage: "DISPONIBLE" } });

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
