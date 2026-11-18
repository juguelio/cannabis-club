"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { formatearCbu } from "@/lib/cbu";
import { ComprobantePago, type CobroClub } from "@/components/comprobante-pago";
import { PasosPedido } from "@/components/checkout-pasos";
import type { ModoEntrega } from "@/lib/entrega";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const g = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;

export type PedidoParaPagar = {
  id: string;
  mode: ModoEntrega;
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
 * renglones, el total y el horario salen de la base. El total va primero y grande —es lo único que el
 * socio tiene que retener—, el alias es el dato principal con su botón de copiar, y el comprobante es
 * obligatorio porque sin él el club no puede rendir el aporte. La única otra salida es cancelar, y es
 * un enlace chico: no compite con la acción.
 */
export function CheckoutPago({ pedido, cobro }: { pedido: PedidoParaPagar; cobro: CobroClub }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  /**
   * Copiar no siempre se puede: el portapapeles exige contexto seguro y, en algunos navegadores, un
   * gesto real. Si falla, se selecciona el texto para que el socio lo copie a mano en vez de quedarse
   * con un botón que no hace nada.
   */
  async function copiar(que: "alias" | "cbu", valor: string) {
    const marcar = () => {
      setCopiado(que);
      setTimeout(() => setCopiado((c) => (c === que ? null : c)), 2000);
    };
    try {
      await navigator.clipboard.writeText(valor);
      marcar();
      return;
    } catch {
      const area = document.createElement("textarea");
      area.value = valor;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
        marcar();
      } catch {
        const el = document.querySelector(que === "alias" ? ".cobro-alias" : ".cobro-dato code");
        if (el) {
          const rango = document.createRange();
          rango.selectNodeContents(el);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(rango);
        }
        setError("No pudimos copiar solo: el dato quedó seleccionado, copialo con Ctrl+C (⌘+C en Mac).");
      } finally {
        area.remove();
      }
    }
  }

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

  const hayCobro = Boolean(cobro.alias || cobro.cbu);

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

      <div className="cuenta-total-grande">
        <small>Transferí</small>
        <b className="tnum">{MONEY.format(pedido.total)}</b>
        <ul className="cuenta">
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
        </ul>
      </div>

      {hayCobro ? (
        <div className="cobro-caja">
          {cobro.alias ? (
            <div className="cobro-principal">
              <small>Alias</small>
              <code className="cobro-alias">{cobro.alias}</code>
              <button
                type="button"
                className={`btn btn-sm${copiado === "alias" ? " btn-ok" : ""}`}
                onClick={() => void copiar("alias", cobro.alias!)}
                aria-live="polite"
              >
                {copiado === "alias" ? <><Check aria-hidden size={14} /> Copiado</> : <><Copy aria-hidden size={14} /> Copiar</>}
              </button>
            </div>
          ) : null}
          <div className="cobro-secundarios">
            {cobro.cbu ? (
              <div className="cobro-dato">
                <span>CBU</span>
                <code>{formatearCbu(cobro.cbu)}</code>
                <button type="button" className="cobro-copiar" onClick={() => void copiar("cbu", cobro.cbu!)} aria-label="Copiar el CBU">
                  {copiado === "cbu" ? <><Check aria-hidden size={13} /> Copiado</> : <><Copy aria-hidden size={13} /> Copiar</>}
                </button>
              </div>
            ) : null}
            {cobro.titular ? <div className="cobro-dato"><span>Titular</span><b>{cobro.titular}</b></div> : null}
            {cobro.banco ? <div className="cobro-dato"><span>Banco</span><b>{cobro.banco}</b></div> : null}
          </div>
          {cobro.nota ? <span className="cell-meta">{cobro.nota}</span> : null}
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
          aporteEstimado={pedido.aporte}
          envioArs={pedido.envio > 0 ? pedido.envio : null}
          modo={pedido.mode}
          pago="PENDIENTE"
          pagoMotivo={null}
          cobro={cobro}
          onSubido={() => router.push(`/portal/pedido/listo/${pedido.id}`)}
          repetirCobro={false}
        />
      </div>

      <div className="checkout-pie">
        <button type="button" className="enlace-chico" onClick={cancelar} disabled={busy}>
          {busy ? "Cancelando…" : "Cancelar el pedido"}
        </button>
        <span className="cell-meta">
          Sin el comprobante el pedido no se cierra: si lo cancelás, el horario y los gramos vuelven a quedar disponibles.
          {" "}
          <Link href="/portal" className="enlace-chico">Volver al catálogo</Link>
        </span>
      </div>
    </div>
  );
}
