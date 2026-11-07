import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarPlus, Check, Clock, PackageCheck } from "lucide-react";
import { getMemberSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pedidoDelSocio } from "@/lib/pedido-socio";
import { faltaComprobante } from "@/lib/pedidos-estado";
import { PasosPedido } from "@/components/checkout-pasos";

export const metadata = { title: "Pedido hecho" };
export const dynamic = "force-dynamic";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

/**
 * El cierre del pedido.
 *
 * Dice la verdad sobre dónde está: **el comprobante está en revisión**, el club todavía no confirmó
 * nada. Antes decía «Confirmado» y «Pedido cerrado», que se lee como que ya está aprobado. La línea de
 * tiempo muestra lo hecho y lo que falta, y el retiro se puede llevar al calendario del teléfono.
 */
export default async function ListoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getMemberSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/portal/clave");

  const { id } = await params;
  const pedido = await pedidoDelSocio(id, session.memberId);
  if (!pedido) notFound();

  // Sin comprobante no hay nada que festejar: se lo devuelve a subirlo.
  if (faltaComprobante(pedido.pago)) redirect(`/portal/pedido/pago/${pedido.id}`);

  // El `.ics` sólo tiene sentido con un turno: un envío no tiene hora.
  const conTurno = await prisma.pickupRequest
    .findFirst({ where: { id: pedido.id, memberId: session.memberId }, select: { appointmentId: true } })
    .then((p) => Boolean(p?.appointmentId));

  const aprobado = pedido.pago === "APROBADO";

  return (
    <div className="checkout-paso">
      <PasosPedido actual={3} />

      <div className="checkout-head">
        <span className="chip chip-brand" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <Clock aria-hidden size={13} /> {aprobado ? "Aprobado por el club" : "Esperando la revisión del club"}
        </span>
        <h1 className="checkout-title">{aprobado ? "Tu pedido está aprobado" : "Recibimos tu comprobante"}</h1>
        <p className="checkout-sub">
          {aprobado
            ? `El club revisó el comprobante de ${MONEY.format(pedido.total)}${pedido.cuando ? `. Queda reservado para ${pedido.cuando}` : ""}.`
            : `Lo revisa una persona del club y te avisa cuando lo aprueba. Son ${MONEY.format(pedido.total)}, transferidos con el comprobante que subiste.`}
        </p>
      </div>

      <ol className="linea-tiempo" aria-label="Estado del pedido">
        <li className="hecho">
          <span className="linea-tiempo-punto"><Check aria-hidden size={12} /></span>
          <div>
            <b>Pedido hecho</b>
            <small>Elegiste la entrega y reservamos los gramos.</small>
          </div>
        </li>
        <li className="hecho">
          <span className="linea-tiempo-punto"><Check aria-hidden size={12} /></span>
          <div>
            <b>Comprobante enviado</b>
            <small>El archivo quedó guardado y cifrado.</small>
          </div>
        </li>
        <li className={aprobado ? "hecho" : "en-curso"}>
          <span className="linea-tiempo-punto">{aprobado ? <Check aria-hidden size={12} /> : null}</span>
          <div>
            <b>El club aprueba el aporte</b>
            <small>{aprobado ? "Ya está aprobado." : "Está en revisión. No hace falta que hagas nada."}</small>
          </div>
        </li>
        <li className={aprobado ? "pendiente" : "pendiente"}>
          <span className="linea-tiempo-punto"><PackageCheck aria-hidden size={12} /></span>
          <div>
            <b>{pedido.mode === "ENVIO" ? "Despacho" : "Retiro en el club"}</b>
            <small>
              {pedido.mode === "ENVIO"
                ? "Sale en el próximo despacho; la entrega la confirma el transportista."
                : pedido.cuando
                  ? `${pedido.cuando}. Traé tu DNI.`
                  : "Te avisamos cuando esté listo."}
            </small>
          </div>
        </li>
      </ol>

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
          {conTurno ? (
            <a href={`/api/portal/pedido/${pedido.id}/ics`} className="btn">
              <CalendarPlus aria-hidden size={16} /> Agregar al calendario
            </a>
          ) : null}
          <Link href="/portal#mis-pedidos" className="btn btn-quiet">Ver mis pedidos</Link>
          <Link href="/portal" className="btn btn-quiet">Volver al catálogo</Link>
        </div>
      </div>
    </div>
  );
}
