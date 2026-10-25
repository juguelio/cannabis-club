import "server-only";
import type { Batch, Member, Shipment, ShipmentItem } from "@prisma/client";
import { prisma } from "./db";
import { dispense } from "./dispensary";
import { conflict, notFound, unprocessable } from "./errors";
import { canDispatch, shipmentCode, totalGrams } from "./shipment-rules";

/**
 * Traslados: la ONG entrega a pacientes que no pasan por la sede.
 *
 * Reglas que no se negocian:
 * - Un ítem no sale sin **DDJJ firmada** por ese paciente (es lo que se muestra a la autoridad en el aeropuerto).
 * - Entregar **no inventa stock**: cada ítem se entrega con `dispense()`, que aplica todos los controles del
 *   dispensario (REPROCANN, topes, lote liberado, recall, stock) y crea el asiento del libro.
 * - Un traslado no se "marca entregado" a mano: se entrega ítem por ítem y el estado lo escribe el sistema.
 */

export type ShipmentItemView = ShipmentItem & { member: Member; batch: Batch & { strain?: { name: string } | null } };

export type ShipmentView = Shipment & {
  items: ShipmentItemView[];
  createdBy: { name: string };
};

export type ShipmentSummary = Shipment & { items: { id: string; grams: unknown; dispensationId: string | null }[] };

export { canDispatch, shipmentCode, totalGrams } from "./shipment-rules";
export type { DispatchCheck } from "./shipment-rules";

export async function createShipment(input: {
  mode: "AEREO" | "TERRESTRE";
  fromAddress: string;
  toAddress: string;
  carrierName: string;
  carrierDoc?: string | null;
  plannedAt?: Date | null;
  noticeRef?: string | null;
  notes?: string | null;
  createdById: string;
}) {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const today = await prisma.shipment.count({ where: { createdAt: { gte: dayStart } } });
  return prisma.shipment.create({
    data: {
      code: shipmentCode(new Date(), today),
      mode: input.mode,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      carrierName: input.carrierName,
      carrierDoc: input.carrierDoc ?? null,
      plannedAt: input.plannedAt ?? null,
      noticeRef: input.noticeRef ?? null,
      notes: input.notes ?? null,
      createdById: input.createdById,
    },
  });
}

export async function addShipmentItem(input: {
  shipmentId: string;
  memberId: string;
  batchId: string;
  grams: number;
  note?: string | null;
}) {
  const shipment = await prisma.shipment.findUnique({ where: { id: input.shipmentId }, include: { items: true } });
  if (!shipment) throw notFound("Traslado inexistente");
  if (shipment.status !== "PREPARACION") throw conflict("SHIPMENT_LOCKED", "El traslado ya salió: no se cambian los pacientes.");

  const member = await prisma.member.findUnique({ where: { id: input.memberId } });
  if (!member) throw notFound("Socio inexistente");
  const batch = await prisma.batch.findUnique({ where: { id: input.batchId } });
  if (!batch) throw notFound("Lote inexistente");
  if (shipment.items.some((i) => i.memberId === input.memberId && i.batchId === input.batchId)) {
    throw conflict("ITEM_EXISTS", "Ese paciente ya tiene ese lote en este traslado.");
  }
  return prisma.shipmentItem.create({
    data: { shipmentId: input.shipmentId, memberId: input.memberId, batchId: input.batchId, grams: input.grams, note: input.note ?? null },
  });
}

export async function setDdjj(input: { itemId: string; signed: boolean; note?: string | null }) {
  const item = await prisma.shipmentItem.findUnique({ where: { id: input.itemId }, include: { shipment: true } });
  if (!item) throw notFound("Ítem inexistente");
  if (item.shipment.status !== "PREPARACION") throw conflict("SHIPMENT_LOCKED", "El traslado ya salió.");
  return prisma.shipmentItem.update({
    where: { id: input.itemId },
    data: { ddjjSignedAt: input.signed ? new Date() : null, ddjjNote: input.note ?? null },
  });
}

export async function dispatchShipment(input: { id: string; actorId: string; ip?: string | null }) {
  const shipment = await prisma.shipment.findUnique({ where: { id: input.id }, include: { items: true } });
  if (!shipment) throw notFound("Traslado inexistente");
  if (shipment.status !== "PREPARACION") throw conflict("SHIPMENT_LOCKED", "El traslado ya fue despachado.");
  const check = canDispatch(shipment.items.map((i) => ({ grams: Number(i.grams), ddjjSignedAt: i.ddjjSignedAt })));
  if (!check.ok) throw unprocessable("SHIPMENT_INCOMPLETE", check.reason);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.shipment.update({
      where: { id: input.id },
      data: { status: "DESPACHADO", departedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "SHIPMENT_DISPATCH",
        entity: "Shipment",
        entityId: input.id,
        ip: input.ip ?? null,
        payload: { code: shipment.code, items: shipment.items.length, grams: totalGrams(shipment.items) },
      },
    });
    return updated;
  });
}

export type DeliveryResult = {
  itemId: string;
  ok: boolean;
  dispensationId?: string;
  error?: string;
  message?: string;
};

/**
 * Entrega el traslado ítem por ítem con el dispensario real. No es atómico a propósito: si un paciente
 * no puede recibir (REPROCANN vencido, tope, lote retirado), los demás igual se registran y el que falló
 * queda informado. Un traslado que no se puede entregar completo **no se puede** dejar a medias sin decirlo.
 */
export async function deliverShipment(input: { id: string; actorId: string; ip?: string | null }): Promise<{
  delivery: DeliveryResult[];
  status: Shipment["status"];
}> {
  const shipment = await prisma.shipment.findUnique({ where: { id: input.id }, include: { items: true } });
  if (!shipment) throw notFound("Traslado inexistente");
  if (shipment.status === "CANCELADO") throw conflict("SHIPMENT_CANCELLED", "El traslado está cancelado.");
  if (shipment.status === "PREPARACION") throw conflict("SHIPMENT_NOT_DISPATCHED", "Primero hay que despachar el traslado.");

  const delivery: DeliveryResult[] = [];
  for (const item of shipment.items) {
    if (item.dispensationId) {
      delivery.push({ itemId: item.id, ok: true, dispensationId: item.dispensationId });
      continue;
    }
    try {
      const result = await dispense({
        memberId: item.memberId,
        batchId: item.batchId,
        grams: Number(item.grams),
        signatureType: "REGISTRO_OPERADOR",
        notes: `Traslado ${shipment.code} a ${shipment.toAddress}`,
        operatorId: input.actorId,
        ip: input.ip ?? null,
        idempotencyKey: `ship-${item.id}`,
      });
      await prisma.shipmentItem.update({ where: { id: item.id }, data: { dispensationId: result.dispensation.id } });
      delivery.push({ itemId: item.id, ok: true, dispensationId: result.dispensation.id });
    } catch (error) {
      const e = error as { code?: string; message?: string; status?: number };
      delivery.push({ itemId: item.id, ok: false, error: e.code ?? "ERROR", message: e.message });
    }
  }

  const fresh = await prisma.shipment.findUnique({ where: { id: input.id }, include: { items: true } });
  const allDelivered = Boolean(fresh && fresh.items.length > 0 && fresh.items.every((i) => i.dispensationId));
  const status: Shipment["status"] = allDelivered ? "ENTREGADO" : "DESPACHADO";
  const updated = await prisma.shipment.update({
    where: { id: input.id },
    data: { status, deliveredAt: allDelivered ? new Date() : null },
  });
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: "SHIPMENT_DELIVER",
      entity: "Shipment",
      entityId: input.id,
      ip: input.ip ?? null,
      payload: { code: shipment.code, delivered: delivery.filter((d) => d.ok).length, failed: delivery.filter((d) => !d.ok).length },
    },
  });
  return { delivery, status: updated.status };
}

export async function cancelShipment(input: { id: string; actorId: string; reason: string; ip?: string | null }) {
  const shipment = await prisma.shipment.findUnique({ where: { id: input.id }, include: { items: true } });
  if (!shipment) throw notFound("Traslado inexistente");
  if (shipment.items.some((i) => i.dispensationId)) {
    throw conflict("SHIPMENT_HAS_DELIVERIES", "Ya tiene entregas registradas: no se cancela. Anulá las entregas una por una y dejá el registro.");
  }
  const updated = await prisma.shipment.update({ where: { id: input.id }, data: { status: "CANCELADO", notes: [shipment.notes, `Cancelado: ${input.reason}`].filter(Boolean).join("\n") } });
  await prisma.auditLog.create({
    data: { actorId: input.actorId, action: "SHIPMENT_CANCEL", entity: "Shipment", entityId: input.id, ip: input.ip ?? null, payload: { reason: input.reason } },
  });
  return updated;
}

export async function listShipments(): Promise<ShipmentSummary[]> {
  return prisma.shipment.findMany({
    include: { items: { select: { id: true, grams: true, dispensationId: true } } },
    orderBy: [{ plannedAt: "desc" }, { createdAt: "desc" }],
    take: 80,
  });
}

export async function shipmentDetail(id: string): Promise<ShipmentView | null> {
  return prisma.shipment.findUnique({
    where: { id },
    include: {
      items: { include: { member: true, batch: { include: { strain: true } } }, orderBy: { createdAt: "asc" } },
      createdBy: { select: { name: true } },
    },
  });
}
