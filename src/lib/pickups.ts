/**
 * Reservas de retiro del portal del socio.
 *
 * Regla que manda: esto NO es una venta. El socio reserva gramos de la producción del club y
 * paga un aporte de cultivo prorrateado cuando retira, en el club, con REPROCANN a la vista.
 * La reserva no habilita la entrega: el dispensario vuelve a validar todo.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { conflict, notFound, unprocessable } from "./errors";
import { isClosedDay } from "./closed-days";
import { getClub, limitsFromClub } from "./club";
import { balanceOf, periodOf } from "./account";
import { memberUsage, memberUsageAt } from "./dispensary";
import { evaluatePickup, round2 } from "./pickup-rules";
import { addDaysKey, dayKeyOf, evaluateBooking, labelOf, slotInstant, type Rule } from "./appointments";
import { daysToExpiry } from "./labels";
import { availableStock } from "./stock";

type Tx = Prisma.TransactionClient | typeof prisma;

const OPEN_STATUSES = ["SOLICITADA", "CONFIRMADA"] as const;

const stockTotal = (tx: Tx) => availableStock(tx);

function ageYears(birth: Date, now = new Date()) {
  let a = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) a -= 1;
  return a;
}

function limitsForMember(
  member: { birthDate: Date; reprocannStatus: string; reprocannExpiresAt: Date | null },
  config: ReturnType<typeof limitsFromClub>,
) {
  const isMinor = ageYears(member.birthDate) < config.edadLimiteMenor;
  const days = daysToExpiry(member.reprocannExpiresAt);
  const reprocannOk =
    !config.requiereReprocann ||
    (member.reprocannStatus === "VIGENTE" && (days == null || days >= 0));
  return {
    isMinor,
    monthLimitG: isMinor ? Math.min(config.limiteMenorG, config.limiteMensualG) : config.limiteMensualG,
    dayLimitG: config.limiteDiarioG,
    thcMaxPct: isMinor ? config.thcMaxMenor : null,
    reprocannOk,
    reprocannDays: days,
  };
}

export type PortalOverview = Awaited<ReturnType<typeof portalOverview>>;

export async function portalOverview(memberId: string) {
  await expireStale();

  const [member, club] = await Promise.all([prisma.member.findUnique({ where: { id: memberId } }), getClub()]);
  if (!member) throw notFound("Socio inexistente");

  const config = limitsFromClub(club);
  const limits = limitsForMember(member, config);
  const [usage, pending, stockFisico, reservadoGlobal, pickups] = await Promise.all([
    memberUsage(prisma, member.id, club.timezone),
    prisma.pickupRequest.findMany({
      where: { memberId: member.id, status: { in: [...OPEN_STATUSES] } },
      select: { grams: true },
    }),
    stockTotal(prisma),
    prisma.pickupRequest.aggregate({ where: { status: { in: [...OPEN_STATUSES] } }, _sum: { grams: true } }),
    prisma.pickupRequest.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { appointment: { select: { scheduledAt: true } } },
    }),
  ]);

  const pendingGrams = round2(pending.reduce((a, p) => a + Number(p.grams), 0));
  const stock = round2(Math.max(0, stockFisico - Number(reservadoGlobal._sum.grams ?? 0)));
  const disponibleMes = round2(Math.max(0, limits.monthLimitG - usage.monthGrams - pendingGrams));
  const disponibleDia = round2(Math.max(0, limits.dayLimitG - usage.dayGrams));
  const candidates: { key: "mes" | "dia" | "stock"; value: number }[] = [
    { key: "mes", value: disponibleMes },
    { key: "dia", value: disponibleDia },
    { key: "stock", value: stock },
  ];
  const binding = candidates.reduce((a, b) => (b.value < a.value ? b : a));
  const tope = round2(Math.max(0, binding.value));
  const aportePorGramo = club.aportePorGramo == null ? null : Number(club.aportePorGramo);

  // Estado de cuenta: el socio ve lo que debe o lo que tiene a favor, sin editar nada.
  const asientos = await prisma.accountEntry.findMany({
    where: { memberId: member.id },
    select: { kind: true, amountArs: true, concept: true, occurredAt: true },
  });
  const saldo = balanceOf(asientos);
  const periodoActual = periodOf(new Date());
  const aporteMes = asientos
    .filter((a) => a.concept === "APORTE_CULTIVO" && periodOf(a.occurredAt) === periodoActual)
    .reduce((acc, a) => acc + Number(a.amountArs), 0);

  return {
    member: {
      id: member.id,
      legajo: member.legajo,
      firstName: member.firstName,
      lastName: member.lastName,
      status: member.status,
      reprocannStatus: member.reprocannStatus,
      reprocannNumber: member.reprocannNumber,
      reprocannExpiresAt: member.reprocannExpiresAt ? member.reprocannExpiresAt.toISOString() : null,
      reprocannOk: limits.reprocannOk,
      reprocannDays: limits.reprocannDays,
      consumptionType: member.consumptionType,
      monthlyForecastG: member.monthlyForecastG == null ? null : Number(member.monthlyForecastG),
    },
    club: { nombre: club.nombre, timezone: club.timezone, aportePorGramo },
    cuenta: { saldo, periodo: periodoActual, aportesDelMes: Math.round(aporteMes * 100) / 100 },
    limits: {
      monthLimitG: limits.monthLimitG,
      dayLimitG: limits.dayLimitG,
      isMinor: limits.isMinor,
      thcMaxPct: limits.thcMaxPct,
    },
    usage,
    pendingGrams,
    disponibleMes,
    disponibleDia,
    stock,
    /** Cuánto puede reservar ahora mismo (el mínimo de los tres topes). */
    tope,
    /** Qué tope está limitando la reserva ahora mismo (para explicarlo en pantalla). */
    topeMotivo: binding.key,
    /** Aporte estimado si reserva el tope. */
    aporteEstimadoTope: aportePorGramo == null ? null : round2(aportePorGramo * tope),
    pickups: pickups.map((p) => ({
      id: p.id,
      grams: Number(p.grams),
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      pickupAt: p.appointment?.scheduledAt.toISOString() ?? null,
      pickupLabel: p.appointment
        ? `${dayKeyOf(p.appointment.scheduledAt).split("-").reverse().slice(0, 2).join("/")} · ${labelOf(p.appointment.scheduledAt)}`
        : null,
      aporteEstimado: p.aporteEstimado == null ? null : Number(p.aporteEstimado),
      cancelReason: p.cancelReason,
    })),
  };
}

/** Alta de reserva: crea turno + reserva en la misma transacción. */
export async function createPickup(input: {
  memberId: string;
  grams: number;
  dayKey: string;
  startMin: number;
  notes?: string;
}) {
  const club = await getClub();
  const config = limitsFromClub(club);

  return prisma.$transaction(
    async (tx) => {
      const member = await tx.member.findUnique({ where: { id: input.memberId } });
      if (!member) throw notFound("Socio inexistente");

      const limits = limitsForMember(member, config);
      // El cupo se mide en la fecha del retiro, no con el consumo de hoy (R04 del REA).
      if (await isClosedDay(tx, input.dayKey))
        throw unprocessable("DAY_CLOSED", "Ese día el dispensario no atiende: elegí otra fecha.");
      const at = slotInstant(input.dayKey, input.startMin);
      const [usage, pendingRows, stockFisico, reservadoGlobal, dayRows] = await Promise.all([
        memberUsageAt(tx, member.id, club.timezone, at),
        tx.pickupRequest.findMany({ where: { memberId: member.id, status: { in: [...OPEN_STATUSES] } }, select: { grams: true } }),
        stockTotal(tx),
        tx.pickupRequest.aggregate({ where: { status: { in: [...OPEN_STATUSES] } }, _sum: { grams: true } }),
        tx.appointment.findMany({
          where: { scheduledAt: { gte: slotInstant(input.dayKey, 0), lt: slotInstant(addDaysKey(input.dayKey, 1), 0) } },
          select: { id: true, memberId: true, scheduledAt: true, status: true },
        }),
      ]);

      const pendingGrams = round2(pendingRows.reduce((a, p) => a + Number(p.grams), 0));
      // Lo que se puede prometer es el stock físico menos lo que ya está reservado por cualquiera:
      // dos socios no pueden reservar el mismo saldo (R04 del REA).
      const reservado = round2(Number(reservadoGlobal._sum.grams ?? 0));
      const stock = round2(Math.max(0, stockFisico - reservado));
      const decision = evaluatePickup({
        grams: input.grams,
        memberActive: member.status === "ACTIVO",
        reprocannOk: limits.reprocannOk,
        monthLimitG: limits.monthLimitG,
        monthUsedG: usage.monthGrams,
        pendingGrams,
        dayLimitG: limits.dayLimitG,
        dayUsedG: usage.dayGrams,
        stockG: stock,
      });
      if (!decision.ok) throw unprocessable(decision.code, decision.message);

      // Si ya tiene un turno abierto ese día, la reserva se cuelga de él:
      // no tiene sentido mandar al socio a sacar dos turnos para el mismo retiro.
      const existing = dayRows.find(
        (r) => r.memberId === member.id && ["PENDIENTE", "CONFIRMADO"].includes(r.status),
      );

      let appointment = existing ?? null;
      if (!appointment) {
        const rules = (await tx.scheduleRule.findMany({ orderBy: [{ weekday: "asc" }, { startMin: "asc" }] })) as Rule[];
        const slot = evaluateBooking({
          dayKey: input.dayKey,
          startMin: input.startMin,
          rules,
          appointments: dayRows,
          memberAppointments: dayRows.filter((r) => r.memberId === member.id),
          member: { status: member.status },
        });
        if (!slot.ok) throw unprocessable(slot.code, slot.message);

        appointment = await tx.appointment.create({
          data: {
            memberId: member.id,
            scheduledAt: slot.at,
            status: "PENDIENTE",
            channel: "WEB",
            notes: "Reserva de retiro del portal",
          },
        });
      }

      const aportePorGramo = club.aportePorGramo == null ? null : new Prisma.Decimal(Number(club.aportePorGramo).toFixed(2));
      const pickup = await tx.pickupRequest.create({
        data: {
          memberId: member.id,
          grams: new Prisma.Decimal(input.grams.toFixed(2)),
          status: "SOLICITADA",
          appointmentId: appointment.id,
          aportePorGramo,
          aporteEstimado: aportePorGramo == null ? null : new Prisma.Decimal(round2(Number(aportePorGramo) * input.grams).toFixed(2)),
          limitSnapshot: {
            checkedAt: new Date().toISOString(),
            grams: input.grams,
            monthLimitG: limits.monthLimitG,
            monthUsedG: usage.monthGrams,
            pendingGrams,
            dayLimitG: limits.dayLimitG,
            dayUsedG: usage.dayGrams,
            stockG: stock,
            stockFisicoG: stockFisico,
            reservadoGlobalG: reservado,
            remainingAfterG: decision.remainingAfterG,
          } as Prisma.InputJsonValue,
          notes: input.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: null,
          action: "PICKUP_CREATE",
          entity: "PickupRequest",
          entityId: pickup.id,
          payload: { memberId: member.id, grams: input.grams, dayKey: input.dayKey, startMin: input.startMin },
        },
      });

      return { pickup, appointment };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
  );
}

export async function cancelPickup(input: { id: string; actorId: string | null; reason: string; memberId?: string }) {
  const pickup = await prisma.pickupRequest.findUnique({ where: { id: input.id } });
  if (!pickup) throw notFound("Reserva inexistente");
  if (input.memberId && pickup.memberId !== input.memberId) throw notFound("Reserva inexistente");
  if (!OPEN_STATUSES.includes(pickup.status as (typeof OPEN_STATUSES)[number])) {
    throw conflict("PICKUP_NOT_OPEN", "Esa reserva ya está cerrada.");
  }
  if (!input.reason.trim()) throw unprocessable("CANCEL_REASON_REQUIRED", "Hace falta el motivo de la cancelación.");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.pickupRequest.update({
      where: { id: pickup.id },
      data: { status: "CANCELADA", canceledAt: new Date(), cancelReason: input.reason.trim() },
    });
    if (pickup.appointmentId) {
      await tx.appointment.update({
        where: { id: pickup.appointmentId },
        data: { status: "CANCELADO", canceledAt: new Date(), cancelReason: `Reserva cancelada: ${input.reason.trim()}` },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "PICKUP_CANCEL",
        entity: "PickupRequest",
        entityId: pickup.id,
        payload: { reason: input.reason.trim() },
      },
    });
    return updated;
  });
}

/** Reservas viejas sin retirar: no se borran, se marcan vencidas a los 7 días. */
export async function expireStale() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.pickupRequest.updateMany({
    where: { status: { in: [...OPEN_STATUSES] }, createdAt: { lt: cutoff } },
    data: { status: "VENCIDA", canceledAt: new Date(), cancelReason: "Venció sin retirarse" },
  });
}

export async function listPickups() {
  await expireStale();
  const rows = await prisma.pickupRequest.findMany({
    where: { status: { in: [...OPEN_STATUSES] } },
    orderBy: { createdAt: "asc" },
    take: 40,
    include: { member: true, appointment: { select: { scheduledAt: true } } },
  });
  return rows.map((p) => ({
    id: p.id,
    memberId: p.memberId,
    legajo: p.member.legajo,
    memberName: `${p.member.lastName}, ${p.member.firstName}`,
    grams: Number(p.grams),
    status: p.status,
    aporteEstimado: p.aporteEstimado == null ? null : Number(p.aporteEstimado),
    pickupLabel: p.appointment
      ? `${dayKeyOf(p.appointment.scheduledAt).split("-").reverse().slice(0, 2).join("/")} · ${labelOf(p.appointment.scheduledAt)}`
      : null,
    pickupAt: p.appointment?.scheduledAt.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }));
}

/**
 * El mostrador sólo puede CONFIRMAR una reserva (o cancelarla con motivo).
 * "Retirada" no es un botón: lo marca la entrega real, en la misma transacción.
 */
export async function confirmPickup(input: { id: string; actorId: string }) {
  return prisma.$transaction(async (tx) => {
    const pickup = await tx.pickupRequest.findUnique({ where: { id: input.id } });
    if (!pickup) throw notFound("Reserva inexistente");
    if (pickup.status !== "SOLICITADA") throw conflict("PICKUP_NOT_PENDING", "Esa reserva ya fue confirmada o cerrada.");
    const updated = await tx.pickupRequest.update({
      where: { id: pickup.id },
      data: { status: "CONFIRMADA", confirmedAt: new Date() },
    });
    if (pickup.appointmentId) {
      const appt = await tx.appointment.findUnique({ where: { id: pickup.appointmentId }, select: { status: true } });
      if (appt?.status === "PENDIENTE")
        await tx.appointment.update({ where: { id: pickup.appointmentId }, data: { status: "CONFIRMADO", operatorId: input.actorId } });
    }
    await tx.auditLog.create({
      data: { actorId: input.actorId, action: "PICKUP_CONFIRM", entity: "PickupRequest", entityId: pickup.id },
    });
    return updated;
  });
}
