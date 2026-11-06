"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { formatearCbu } from "@/lib/cbu";
import { ComprobantePago, type CobroClub } from "@/components/comprobante-pago";
import { PasosPedido } from "@/components/checkout-pasos";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const g = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;

export type PedidoParaPagar = {
  id: string;
  grams: number;
  aporte: number | null;
  envio: number;
  total: number;
  cuando: string | null;
  direccion: string | null;
  items: { nombre: string; gramos: number; monto: number | null }[];
};

/**
 * Paso 2: la cuenta y el comprobante, en su propia página.
 *
 * El pedido ya existe (se creó al elegir la entrega), así que esta pantalla se puede recargar: los
 * renglones, el total y el horario salen de la base. El comprobante es obligatorio porque sin él el
 * club no puede rendir el aporte; la única otra salida es cancelar y liberar el horario.
 */
export function CheckoutPago({
  pedido,
  cobro,
}: {
  pedido: PedidoParaPagar;
  cobro: CobroClub;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancelar() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/portal/pickups/${pedido.id}/cancel`, { body: { reason: "El socio no completó el comprobante" } });
      router.push("/portal");
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  }

  return (
    <div className="checkout-paso">
      <PasosPedido actual={2} />

      <div className="checkout-head">
        <h1 className="checkout-title">La cuenta</h1>
        <p className="checkout-sub">
          {pedido.cuando ? `${pedido.cuando} · ` : ""}
          {g(pedido.grams)}
        </p>
      </div>

      <ul className="cuenta cuenta-grande">
        {pedido.items.map((i) => (
          <li key={i.nombre}>
            <span>{i.nombre} · {g(i.gramos)}</span>
            <span className="tnum">{i.monto != null ? MONEY.format(i.monto) : "—"}</span>
          </li>
        ))}
        {pedido.envio > 0 ? (
          <li>
            <span>Envío{pedido.direccion ? ` a ${pedido.direccion}` : ""}</span>
            <span className="tnum">{MONEY.format(pedido.envio)}</span>
          </li>
        ) : null}
        <li className="cuenta-total">
          <span>Total a transferir</span>
          <span className="tnum">{MONEY.format(pedido.total)}</span>
        </li>
      </ul>

      {cobro.alias || cobro.cbu ? (
        <div className="cobro-caja">
          <b>Transferí a estos datos</b>
          {cobro.alias ? (
            <div className="cobro-dato">
              <span>Alias</span>
              <code>{cobro.alias}</code>
              <button type="button" className="cobro-copiar" onClick={() => void navigator.clipboard?.writeText(cobro.alias!)} aria-label="Copiar el alias">
                <Copy aria-hidden size={13} /> Copiar
              </button>
            </div>
          ) : null}
          {cobro.cbu ? (
            <div className="cobro-dato">
              <span>CBU</span>
              <code>{formatearCbu(cobro.cbu)}</code>
              <button type="button" className="cobro-copiar" onClick={() => void navigator.clipboard?.writeText(cobro.cbu!)} aria-label="Copiar el CBU">
                <Copy aria-hidden size={13} /> Copiar
              </button>
            </div>
          ) : null}
          {cobro.titular ? <div className="cobro-dato"><span>Titular</span><b>{cobro.titular}</b></div> : null}
          {cobro.banco ? <div className="cobro-dato"><span>Banco</span><b>{cobro.banco}</b></div> : null}
        </div>
      ) : (
        <p className="note note-warn" style={{ margin: 0 }}>
          <span>El club todavía no cargó los datos de cobro: pedí el alias en la secretaría antes de transferir.</span>
        </p>
      )}

      {error ? <div className="note note-danger" role="alert">{error}</div> : null}

      <div className="checkout-bloque">
        <ComprobantePago
          pickupId={pedido.id}
          aporteEstimado={pedido.aporte ?? pedido.total}
          envioArs={pedido.envio > 0 ? pedido.envio : null}
          pago="PENDIENTE"
          pagoMotivo={null}
          cobro={cobro}
          onSubido={() => router.push(`/portal/pedido/listo/${pedido.id}`)}
          repetirCobro={false}
        />
      </div>

      <div className="checkout-cta">
        <button type="button" className="btn btn-quiet" onClick={cancelar} disabled={busy}>
          {busy ? "Cancelando…" : "Cancelar el pedido"}
        </button>
        <span className="cell-meta">
          Sin el comprobante el pedido no se cierra: si lo cancelás, el horario y los gramos vuelven a quedar disponibles.
        </span>
      </div>
    </div>
  );
}
