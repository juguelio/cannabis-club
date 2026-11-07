import { prisma } from "./db";
import { dayKeyOf, labelOf } from "./appointments";
import {
  columnaDelPedido,
  type ColumnaTablero,
  type ParaPreparar,
  type PedidoTablero,
} from "./tablero-pedidos";

const dosDecimales = (n: number) => Math.round(n * 100) / 100;

/**
 * Los pedidos abiertos (y los cerrados de hoy) con lo que el club necesita para trabajar cada uno.
 *
 * Una sola consulta, sin migración: el estado se deriva del pedido, su último comprobante y el ítem de
 * traslado. Lo cancelado y lo vencido no entran: no son trabajo.
 */
export async function tableroPedidos(): Promise<{
  pedidos: PedidoTablero[];
  paraPreparar: ParaPreparar[];
}> {
  const hoy = dayKeyOf(new Date());
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);

  const rows = await prisma.pickupRequest.findMany({
    where: {
      OR: [
        { status: { in: ["SOLICITADA", "CONFIRMADA"] } },
        { status: "RETIRADA", updatedAt: { gte: desde } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      deliveryMode: true,
      grams: true,
      createdAt: true,
      updatedAt: true,
      deliveryZona: true,
      deliveryAddress: true,
      deliveryCostoArs: true,
      aporteEstimado: true,
      appointment: { select: { scheduledAt: true } },
      member: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          legajo: true,
          reprocannStatus: true,
          reprocannExpiresAt: true,
        },
      },
      items: { select: { strainName: true, grams: true } },
      paymentProofs: {
        select: { id: true, status: true, montoArs: true, createdAt: true, motivo: true },
        orderBy: { createdAt: "asc" },
      },
      shipmentItem: { select: { id: true, dispensationId: true, shipment: { select: { status: true } } } },
      dispensationId: true,
    },
  });

  const pedidos: PedidoTablero[] = [];
  for (const p of rows) {
    const ultimo = p.paymentProofs[p.paymentProofs.length - 1] ?? null;
    const pago =
      ultimo == null
        ? "PENDIENTE"
        : (ultimo.status as "EN_REVISION" | "APROBADO" | "RECHAZADO");
    const traslado = (p.shipmentItem?.shipment?.status ?? null) as
      | "PREPARACION"
      | "DESPACHADO"
      | "ENTREGADO"
      | "CANCELADO"
      | null;
    const salio = Boolean(p.dispensationId || p.shipmentItem?.dispensationId);
    const cerradoHoy =
      (p.status === "RETIRADA" || traslado === "ENTREGADO") && dayKeyOf(p.updatedAt) === hoy;

    const columna = columnaDelPedido({ status: p.status, pago, salio, traslado, cerradoHoy });
    if (!columna) continue;

    const cuando = p.appointment
      ? `${dayKeyOf(p.appointment.scheduledAt).split("-").reverse().slice(0, 2).join("/")} · ${labelOf(p.appointment.scheduledAt)}`
      : p.deliveryZona;

    pedidos.push({
      id: p.id,
      columna,
      mode: p.deliveryMode,
      grams: Number(p.grams),
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      cuando,
      member: {
        id: p.member.id,
        nombre: `${p.member.lastName}, ${p.member.firstName}`,
        legajo: p.member.legajo,
        reprocann: p.member.reprocannStatus,
        venceReprocann: p.member.reprocannExpiresAt
          ? p.member.reprocannExpiresAt.toISOString().slice(0, 10)
          : null,
      },
      items: p.items.map((i) => ({ nombre: i.strainName, gramos: Number(i.grams) })),
      comprobante: ultimo
        ? {
            id: ultimo.id,
            estado: ultimo.status,
            monto: ultimo.montoArs == null ? null : Number(ultimo.montoArs),
            createdAt: ultimo.createdAt.toISOString(),
            motivo: ultimo.motivo,
          }
        : null,
      esperado:
        p.aporteEstimado == null
          ? null
          : dosDecimales(Number(p.aporteEstimado) + Number(p.deliveryCostoArs ?? 0)),
      direccion: p.deliveryAddress,
      zona: p.deliveryZona,
    });
  }

  // «Para preparar hoy»: lo que está en A_PREPARAR, sumado por variedad. El club arma una vez y no
  // pedido por pedido.
  const acumulado = new Map<string, ParaPreparar>();
  for (const p of pedidos.filter((x) => x.columna === "A_PREPARAR")) {
    for (const i of p.items) {
      const actual = acumulado.get(i.nombre) ?? { nombre: i.nombre, gramos: 0, pedidos: 0 };
      actual.gramos = dosDecimales(actual.gramos + i.gramos);
      acumulado.set(i.nombre, actual);
    }
    for (const nombre of new Set(p.items.map((i) => i.nombre))) {
      const a = acumulado.get(nombre);
      if (a) a.pedidos += 1;
    }
  }

  return {
    pedidos,
    paraPreparar: [...acumulado.values()].sort((a, b) => b.gramos - a.gramos),
  };
}

export type { ColumnaTablero };
