import { notFound, redirect } from "next/navigation";
import { getMemberSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { leerCobro } from "@/lib/comprobante-rules";
import { pedidoDelSocio } from "@/lib/pedido-socio";
import { esActivo, faltaComprobante } from "@/lib/pedidos-estado";
import { CheckoutPago, type PedidoParaPagar } from "@/components/checkout-pago";
import type { CobroClub } from "@/components/comprobante-pago";

export const metadata = { title: "Pagar el pedido" };
export const dynamic = "force-dynamic";

export default async function PagoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getMemberSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/portal/clave");

  const { id } = await params;
  const pedido = await pedidoDelSocio(id, session.memberId);
  if (!pedido) notFound();

  // Un pedido cancelado o ya cumplido no se paga: se lo devuelve al portal, donde ve en qué quedó.
  if (!esActivo(pedido.status)) redirect("/portal#mis-pedidos");
  // Con el comprobante en revisión, ya no hay nada que hacer acá.
  if (!faltaComprobante(pedido.pago)) redirect(`/portal/pedido/listo/${pedido.id}`);

  const club = await prisma.club.findFirst({ select: { cobro: true } });
  const cobro: CobroClub = leerCobro(club?.cobro);

  const paraPagar: PedidoParaPagar = {
    id: pedido.id,
    mode: pedido.mode,
    grams: pedido.grams,
    aporte: pedido.aporte,
    envio: pedido.envio,
    total: pedido.total,
    cuando: pedido.cuando,
    direccion: pedido.direccion,
    items: pedido.items,
  };

  return <CheckoutPago pedido={paraPagar} cobro={cobro} />;
}
