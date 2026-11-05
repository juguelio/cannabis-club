/**
 * Reservas de retiro del portal del socio.
 *
 * Regla que manda: esto NO es una venta. El socio reserva gramos de la producción del club y
 * paga un aporte de cultivo prorrateado cuando retira, en el club, con REPROCANN a la vista.
 * La reserva no habilita la entrega: el dispensario vuelve a validar todo.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { badRequest, conflict, notFound, unprocessable } from "./errors";
import { isClosedDay } from "./closed-days";
import { getClub, limitsFromClub } from "./club";
import { balanceOf, periodOf } from "./account";
import { memberUsage, memberUsageAt } from "./dispensary";
import { evaluateEnvio, evaluatePickup, round2 } from "./pickup-rules";
import { gramosPorEnvio, preciosDeClub } from "./precios";
import { estadoDePago, leerCobro } from "./comprobante-rules";
import { addDaysKey, dayKeyOf, evaluateBooking, labelOf, slotInstant, type Rule } from "./appointments";
import { daysToExpiry } from "./labels";
import { availableStock } from "./stock";
import { faltaDomicilioParaEnvio } from "./verificacion-rules";

type Tx = Prisma.TransactionClient | typeof prisma;

const OPEN_STATUSES = ["SOLICITADA", "CONFIRMADA"] as const;

const stockTotal = (tx: Tx) => availableStock(tx);

function ageYears(birth: Date, now = new Date()) {
  let a = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) a -= 1;
  return a;
}

function limitsForMember(
  member: { birthDate: Date | null; reprocannStatus: string; reprocannExpiresAt: Date | null },
  config: ReturnType<typeof limitsFromClub>,
) {
  // Sin fecha de nacimiento no hay edad: no se asume mayor de edad (el socio todavía no se validó).
  const isMinor = member.birthDate ? ageYears(member.birthDate) < config.edadLimiteMenor : false;
  const birthMissing = member.birthDate === null;
  const days = daysToExpiry(member.reprocannExpiresAt);
  const reprocannOk =
    !config.requiereReprocann ||
    (member.reprocannStatus === "VIGENTE" && (days == null || days >= 0));
  return {
    isMinor,
    birthMissing,
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
  const precios = preciosDeClub(club);
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

  // Estado del comprobante por pedido: el portal muestra si falta transferir, si está en revisión o si
  // el club lo aprobó. Los archivos no viajan acá, sólo el estado.
  const comprobantes = pickups.length
    ? await prisma.paymentProof.findMany({
        where: { pickupId: { in: pickups.map((p) => p.id) } },
        select: { pickupId: true, status: true, createdAt: true, motivo: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const pagoPorPedido = new Map<string, { estado: ReturnType<typeof estadoDePago>; motivo: string | null }>();
  for (const p of pickups) {
    const propios = comprobantes.filter((c) => c.pickupId === p.id);
    const ultimo = propios[propios.length - 1];
    pagoPorPedido.set(p.id, { estado: estadoDePago(propios), motivo: ultimo?.motivo ?? null });
  }

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
      address: member.address,
      locality: member.locality,
      postalCode: member.postalCode,
    },
    club: {
      nombre: club.nombre,
      timezone: club.timezone,
      aportePorGramo,
      // Envío: zonas con su costo y demora, y cuántos gramos entran en una caja.
      envios: precios.envios,
      topeEnvioG: gramosPorEnvio(precios),
      // A dónde transferir el aporte: lo carga el club, no se inventa acá.
      cobro: leerCobro(club.cobro),
    },
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
      deliveryMode: p.deliveryMode,
      deliveryZona: p.deliveryZona,
      deliveryCostoArs: p.deliveryCostoArs == null ? null : Number(p.deliveryCostoArs),
      pago: pagoPorPedido.get(p.id)?.estado ?? "PENDIENTE",
      pagoMotivo: pagoPorPedido.get(p.id)?.motivo ?? null,
    })),
  };
}

/** Alta de reserva: crea turno + reserva en la misma transacción. */
export async function createPickup(input: {
  memberId: string;
  grams: number;
  /** RETIRO (default) trae turno; ENVIO no, viaja al domicilio. */
  mode?: "RETIRO" | "ENVIO";
  dayKey?: string;
  startMin?: number;
  zona?: string;
  direccion?: string;
  notes?: string;
  /**
   * Qué variedades y cuántos gramos de cada una. Es opcional para no romper los llamados viejos,
   * pero el portal siempre lo manda: el club prepara el combo que el socio eligió.
   */
  items?: { strainId: string; grams: number }[];
}) {
  const club = await getClub();
  const config = limitsFromClub(club);
  const modo = input.mode ?? "RETIRO";
  const esEnvio = modo === "ENVIO";
  const precios = preciosDeClub(club);

  return prisma.$transaction(
    async (tx) => {
      const member = await tx.member.findUnique({ where: { id: input.memberId } });
      if (!member) throw notFound("Socio inexistente");

      // Sin DNI y REPROCANN validados en la plataforma no se reserva: el pedido nacería para ser
      // rechazado en la entrega. El socio lo ve en el portal, y acá está la puerta del servidor.
      if (member.verificationStatus !== "VERIFICADO")
        throw conflict(
          "VERIFICACION_PENDIENTE",
          member.verificationStatus === "EN_REVISION"
            ? "Tu legajo está en revisión: cuando el club valide tu DNI y tu REPROCANN vas a poder pedir."
            : "Antes de pedir tenés que validar tu DNI y tu REPROCANN en tu portal.",
        );

      // Un envío sin domicilio completo no sale: el padrón importado tiene 8 legajos sin localidad o sin
      // código postal, y el paquete no se despacha con media dirección. Se completa en la validación.
      if (esEnvio && faltaDomicilioParaEnvio(member))
        throw conflict(
          "ENVIO_SIN_DOMICILIO",
          "Para pedir un envío necesitamos tu domicilio y código postal: completalos en «Mis datos», en tu portal.",
        );

      const limits = limitsForMember(member, config);
      // El cupo se mide en la fecha del retiro, no con el consumo de hoy (R04 del REA).
      // Un envío no tiene fecha de retiro: se mide con el consumo de ahora.
      if (!esEnvio) {
        if (!input.dayKey || input.startMin == null)
          throw unprocessable("SLOT_REQUIRED", "Elegí día y horario para retirar en el club.");
        if (await isClosedDay(tx, input.dayKey))
          throw unprocessable("DAY_CLOSED", "Ese día el dispensario no atiende: elegí otra fecha.");
      }
      const at = esEnvio ? new Date() : slotInstant(input.dayKey!, input.startMin!);
      const [usage, pendingRows, stockFisico, reservadoGlobal, dayRows] = await Promise.all([
        memberUsageAt(tx, member.id, club.timezone, at),
        tx.pickupRequest.findMany({ where: { memberId: member.id, status: { in: [...OPEN_STATUSES] } }, select: { grams: true } }),
        stockTotal(tx),
        tx.pickupRequest.aggregate({ where: { status: { in: [...OPEN_STATUSES] } }, _sum: { grams: true } }),
        esEnvio
          ? Promise.resolve([] as { id: string; memberId: string; scheduledAt: Date; status: string }[])
          : tx.appointment.findMany({
              where: { scheduledAt: { gte: slotInstant(input.dayKey!, 0), lt: slotInstant(addDaysKey(input.dayKey!, 1), 0) } },
              select: { id: true, memberId: true, scheduledAt: true, status: true },
            }),
      ]);

      // El detalle tiene que cerrar con el total: si el socio eligió 10 g de una cepa y 5 de otra,
      // la reserva son 15 g. Un desfasaje acá es un pedido que el club no puede armar.
      const items = input.items?.filter((i) => i.grams > 0) ?? [];
      let cepaPorId = new Map<string, string>();
      if (items.length) {
        const suma = round2(items.reduce((a, i) => a + i.grams, 0));
        if (Math.abs(suma - round2(input.grams)) > 0.011)
          throw badRequest(
            "ITEMS_NO_CIERRAN",
            "Los gramos de las variedades no coinciden con el total del pedido. Volvé a armarlo.",
          );
        if (new Set(items.map((i) => i.strainId)).size !== items.length)
          throw badRequest("ITEMS_REPETIDOS", "Hay una variedad repetida en el pedido.");

        const cepas = await tx.strain.findMany({
          where: { id: { in: items.map((i) => i.strainId) } },
          select: { id: true, name: true, active: true },
        });
        if (cepas.length !== items.length)
          throw badRequest("ITEMS_INEXISTENTES", "Alguna de las variedades elegidas ya no está en el catálogo.");
        const inactiva = cepas.find((c) => !c.active);
        if (inactiva) throw badRequest("ITEMS_INACTIVA", `La variedad ${inactiva.name} ya no está disponible.`);
        cepaPorId = new Map(cepas.map((c) => [c.id, c.name]));
      }

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

      // El envío tiene sus propias condiciones: zona del club, dirección y tope por caja.
      let envio: { costoArs: number; demora: string; transportista?: string } | null = null;
      if (esEnvio) {
        const decisionEnvio = evaluateEnvio({
          grams: input.grams,
          direccion: input.direccion ?? "",
          zona: input.zona ?? "",
          zonas: precios.envios,
          topeEnvioG: gramosPorEnvio(precios),
        });
        if (!decisionEnvio.ok) throw unprocessable(decisionEnvio.code, decisionEnvio.message);
        envio = decisionEnvio;
      }

      // Si ya tiene un turno abierto ese día, la reserva se cuelga de él:
      // no tiene sentido mandar al socio a sacar dos turnos para el mismo retiro.
      const existing = esEnvio
        ? undefined
        : dayRows.find((r) => r.memberId === member.id && ["PENDIENTE", "CONFIRMADO"].includes(r.status));

      let appointment: { id: string } | null = existing ?? null;
      if (!esEnvio && !appointment) {
        const rules = (await tx.scheduleRule.findMany({ orderBy: [{ weekday: "asc" }, { startMin: "asc" }] })) as Rule[];
        const slot = evaluateBooking({
          dayKey: input.dayKey!,
          startMin: input.startMin!,
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
          appointmentId: appointment?.id ?? null,
          deliveryMode: modo,
          deliveryAddress: esEnvio ? (input.direccion ?? "").trim() : null,
          deliveryZona: esEnvio ? (input.zona ?? null) : null,
          deliveryDemora: envio?.demora ?? null,
          deliveryTransportista: envio?.transportista ?? null,
          deliveryCostoArs: envio ? new Prisma.Decimal(envio.costoArs.toFixed(2)) : null,
          aportePorGramo,
          aporteEstimado: aportePorGramo == null ? null : new Prisma.Decimal(round2(Number(aportePorGramo) * input.grams).toFixed(2)),
          limitSnapshot: {
            checkedAt: new Date().toISOString(),
            mode: modo,
            ...(envio ? { envio: { zona: input.zona, costoArs: envio.costoArs, demora: envio.demora } } : {}),
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
          items: items.length
            ? {
                create: items.map((i) => ({
                  strainId: i.strainId,
                  strainName: cepaPorId.get(i.strainId) ?? "Variedad",
                  grams: new Prisma.Decimal(i.grams.toFixed(2)),
                })),
              }
            : undefined,
        },
        include: { items: true },
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

  // Una reserva cargada en un traslado no se cancela por acá: si el paquete ya viaja, liberar el
  // cupo deja stock reservado a la vista y un envío que llega sin asiento. Se cancela el traslado.
  const enTraslado = await prisma.shipmentItem.findFirst({
    where: { pickupRequestId: pickup.id, shipment: { status: { in: ["PREPARACION", "DESPACHADO", "ENTREGADO"] } } },
    select: { shipment: { select: { code: true, status: true } } },
  });
  if (enTraslado)
    throw conflict(
      "PICKUP_EN_TRASLADO",
      `Está cargada en el traslado ${enTraslado.shipment.code} (${enTraslado.shipment.status.toLowerCase()}): no se cancela desde acá.`,
    );
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
    where: {
      status: { in: [...OPEN_STATUSES] },
      createdAt: { lt: cutoff },
      // Un pedido cargado en un traslado no vence por calendario: entre preparación y transporte
      // pueden pasar más de siete días, y vencerlo deja el paquete sin poder registrar la entrega.
      shipmentItem: { is: null },
    },
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
    deliveryMode: p.deliveryMode,
    deliveryZona: p.deliveryZona,
    deliveryAddress: p.deliveryAddress,
    deliveryCostoArs: p.deliveryCostoArs == null ? null : Number(p.deliveryCostoArs),
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
