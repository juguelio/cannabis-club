import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getMemberSession } from "@/lib/auth";
import { pedidoDelSocio } from "@/lib/pedido-socio";
import { faltaComprobante } from "@/lib/pedidos-estado";
import { PasosPedido } from "@/components/checkout-pasos";

export const metadata = { title: "Pedido hecho" };
export const dynamic = "force-dynamic";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export default async function ListoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getMemberSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/portal/clave");

  const { id } = await params;
  const pedido = await pedidoDelSocio(id, session.memberId);
  if (!pedido) notFound();

  // Sin comprobante no hay nada que festejar: se lo devuelve a subirlo.
  if (faltaComprobante(pedido.pago)) redirect(`/portal/pedido/pago/${pedido.id}`);

  return (
    <div className="checkout-paso">
      <PasosPedido actual={3} />

      <div className="checkout-head">
        <span className="chip chip-ok" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <Check aria-hidden size={14} /> Pedido cerrado
        </span>
        <h1 className="checkout-title">Listo: lo vamos a revisar</h1>
        <p className="checkout-sub">
          Recibimos tu comprobante por {MONEY.format(pedido.total)}. El club lo revisa y te avisa cuando lo
          aprueba{pedido.cuando ? `. Queda reservado para ${pedido.cuando}` : ""}.
        </p>
      </div>

      <ul className="cuenta cuenta-grande">
        {pedido.items.map((i) => (
          <li key={i.nombre}>
            <span>{i.nombre}</span>
            <span className="tnum">{i.gramos} g</span>
          </li>
        ))}
        {pedido.envio > 0 ? (
          <li>
            <span>Envío{pedido.direccion ? ` a ${pedido.direccion}` : ""}</span>
            <span className="tnum">{MONEY.format(pedido.envio)}</span>
          </li>
        ) : null}
        <li className="cuenta-total">
          <span>Transferiste</span>
          <span className="tnum">{MONEY.format(pedido.total)}</span>
        </li>
      </ul>

      <div className="checkout-cta">
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          <Link href="/portal#mis-pedidos" className="btn">Ver mis pedidos</Link>
          <Link href="/portal" className="btn btn-quiet">Volver al catálogo</Link>
        </div>
      </div>
    </div>
  );
}
