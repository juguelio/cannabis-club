"use client";

import { Minus, Plus, ShoppingBag, X } from "lucide-react";

/**
 * El carrito como panel deslizante, al estilo de los que funcionan: se abre encima del catálogo, se
 * puede seguir eligiendo con el panel abierto, y el resumen no compite con otros cinco paneles de la
 * página. En celular entra como hoja inferior y el pulgar llega a todo.
 *
 * El estado sigue viviendo en el portal: esto es sólo la vista. Si mañana se mueve a `/portal/pedido`,
 * hay una sola fuente de verdad.
 */
export type ItemDrawer = { strainId: string; gramos: number };

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const g = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;

export function CarritoDrawer({
  abierto,
  items,
  tope,
  aportePorGramo,
  nombre,
  onCerrar,
  onDelta,
  onQuitar,
  onContinuar,
  puedeContinuar,
  nota,
}: {
  abierto: boolean;
  items: ItemDrawer[];
  tope: number;
  aportePorGramo: number | null;
  nombre: (id: string) => string;
  onCerrar: () => void;
  onDelta: (strainId: string, paso: number) => void;
  onQuitar: (strainId: string) => void;
  onContinuar: () => void;
  puedeContinuar: boolean;
  /** Aviso contextual: mínimo de envío, tope alcanzado, etc. */
  nota?: string | null;
}) {
  if (!abierto) return null;
  const gramos = items.reduce((n, i) => n + i.gramos, 0);
  const aporte = aportePorGramo != null ? aportePorGramo * gramos : null;

  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label="Tu pedido">
      <button type="button" className="drawer-overlay" aria-label="Cerrar el pedido" onClick={onCerrar} />
      <div className="drawer-panel">
        <header className="drawer-head">
          <div>
            <b style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>Tu pedido</b>
            <div className="cell-meta tnum">
              {g(gramos)} de {g(tope)}
            </div>
          </div>
          <button type="button" className="drawer-x" onClick={onCerrar} aria-label="Cerrar">
            <X aria-hidden size={18} />
          </button>
        </header>

        <div className="drawer-body">
          {items.length === 0 ? (
            <div className="empty" style={{ padding: "28px 8px" }}>
              <ShoppingBag aria-hidden size={22} />
              <p style={{ margin: "8px 0 0" }}>Todavía no elegiste variedades. Sumá 5 g desde el catálogo.</p>
            </div>
          ) : (
            <ul className="drawer-items">
              {items.map((i) => (
                <li key={i.strainId}>
                  <div className="drawer-item-nombre">
                    <b>{nombre(i.strainId)}</b>
                    <span className="cell-meta tnum">{g(i.gramos)}</span>
                  </div>
                  <div className="drawer-item-acciones">
                    <div className="cart-step" aria-label={`Gramos de ${nombre(i.strainId)}`}>
                      <button
                        type="button"
                        className="cart-step-btn"
                        onClick={() => onDelta(i.strainId, -5)}
                        aria-label={`Sacar 5 gramos de ${nombre(i.strainId)}`}
                      >
                        <Minus aria-hidden size={14} />
                      </button>
                      <span className="cart-step-num tnum">{i.gramos}</span>
                      <button
                        type="button"
                        className="cart-step-btn"
                        onClick={() => onDelta(i.strainId, +5)}
                        disabled={gramos + 5 > tope}
                        aria-label={`Sumar 5 gramos de ${nombre(i.strainId)}`}
                      >
                        <Plus aria-hidden size={14} />
                      </button>
                    </div>
                    <button type="button" className="drawer-quitar" onClick={() => onQuitar(i.strainId)}>
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {nota ? <p className="note note-warn" style={{ marginTop: 10 }}>{nota}</p> : null}
        </div>

        <footer className="drawer-foot">
          <div className="cart-linea cart-linea--total" style={{ borderTop: 0, paddingTop: 0 }}>
            <span>Aporte estimado</span>
            <span className="tnum">{aporte != null ? MONEY.format(aporte) : "—"}</span>
          </div>
          <span className="cell-meta">El aporte se prorratea al entregar; el envío, si elegís envío, se suma aparte.</span>
          <button type="button" className="btn btn-lg btn-block" onClick={onContinuar} disabled={!puedeContinuar} style={{ marginTop: 8 }}>
            Continuar
          </button>
          <button type="button" className="btn btn-quiet btn-block" onClick={onCerrar} style={{ marginTop: 6 }}>
            Seguir eligiendo
          </button>
        </footer>
      </div>
    </div>
  );
}
