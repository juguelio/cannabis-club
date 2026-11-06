import { prisma } from "./db";
import { estadoDePago, type EstadoPago } from "./comprobante-rules";
import { dayKeyOf, labelOf } from "./appointments";

/**
 * Un pedido con lo justo para mostrarlo en su propia página.
 *
 * El paso del pago y la pantalla de cierre se pueden recargar, compartir y volver a abrir: los datos
 * salen de la base, no del carrito del navegador. Si el socio cierra la pestaña y entra después, el
 * pedido sigue ahí con lo que efectivamente se reservó.
 */
export type PedidoSocio = {
  id: string;
  status: string;
  mode: "RETIRO" | "ENVIO";
  grams: number;
  aporte: number | null;
  envio: number;
  total: number;
  /** «12/11 · 10:00» para retiro, «CABA · 48 h» para envío. */
  cuando: string | null;
  direccion: string | null;
  items: { nombre: string; gramos: number; monto: number | null }[];
  pago: EstadoPago;
  pagoMotivo: string | null;
  createdAt: string;
};

export async function pedidoDelSocio(id: string, memberId: string): Promise<PedidoSocio | null> {
  const p = await prisma.pickupRequest.findFirst({
    where: { id, memberId },
    select: {
      id: true,
      status: true,
      deliveryMode: true,
      grams: true,
      aportePorGramo: true,
      aporteEstimado: true,
      deliveryZona: true,
      deliveryDemora: true,
      deliveryCostoArs: true,
      deliveryAddress: true,
      createdAt: true,
      appointment: { select: { scheduledAt: true } },
      items: { select: { strainName: true, grams: true } },
      paymentProofs: { select: { status: true, createdAt: true, motivo: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!p) return null;

  const porGramo = p.aportePorGramo == null ? null : Number(p.aportePorGramo);
  const aporte = p.aporteEstimado == null ? null : Number(p.aporteEstimado);
  const envio = p.deliveryCostoArs == null ? 0 : Number(p.deliveryCostoArs);
  const ultimo = p.paymentProofs[p.paymentProofs.length - 1];
  const appt = p.appointment?.scheduledAt ?? null;

  return {
    id: p.id,
    status: p.status,
    mode: p.deliveryMode,
    grams: Number(p.grams),
    aporte,
    envio,
    total: Math.round(((aporte ?? 0) + envio) * 100) / 100,
    cuando: appt
      ? `${dayKeyOf(appt).split("-").reverse().slice(0, 2).join("/")} · ${labelOf(appt)}`
      : p.deliveryZona
        ? `${p.deliveryZona}${p.deliveryDemora ? ` · ${p.deliveryDemora}` : ""}`
        : null,
    direccion: p.deliveryAddress,
    items: p.items.map((i) => ({
      nombre: i.strainName,
      gramos: Number(i.grams),
      monto: porGramo == null ? null : Math.round(porGramo * Number(i.grams) * 100) / 100,
    })),
    pago: estadoDePago(p.paymentProofs),
    pagoMotivo: ultimo?.motivo ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}
