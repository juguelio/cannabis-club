"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { useCarrito } from "@/lib/carrito-cliente";
import { faltaParaMinimo } from "@/lib/envios";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const g = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;

/**
 * El basket como página propia, no como bloque dentro del catálogo: acá se revisa, se ajusta la
 * cantidad por variedad y se pasa al envío. Es el paso que faltaba entre elegir y confirmar.
 */
export function BasketView({
  tope,
  aportePorGramo,
  minimoEnvioG,
  topeEnvioG,
  nombreDe,
}: {
  tope: number;
  aportePorGramo: number | null;
  minimoEnvioG: number;
  topeEnvioG: number;
  nombreDe: Record<string, string>;
}) {
  const { items, total, delta, quitar, vaciar, listo } = useCarrito(tope);
  const aporte = aportePorGramo != null ? aportePorGramo * total : null;
  const nombre = (id: string) => nombreDe[id] ?? "Variedad";
  const falta = faltaParaMinimo(total, minimoEnvioG);
  const pasaTopeEnvio = total > topeEnvioG + 1e-9;

  return (
    <div className="basket-grid">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h1 className="panel-title" style={{ fontSize: 22 }}>Tu basket</h1>
            <p className="panel-sub">
              {listo && items.length > 0
                ? `${items.length} ${items.length === 1 ? "variedad" : "variedades"} · ${g(total)} de ${g(tope)} de tu saldo`
                : "Acá vas a ver lo que elegiste antes de pasar al envío."}
            </p>
          </div>
        </div>

        <div className="panel-body">
          {!listo ? null : items.length === 0 ? (
            <div className="empty" style={{ padding: "34px 10px", display: "grid", gap: 10, justifyItems: "center" }}>
              <ShoppingBasket aria-hidden size={26} />
              <p style={{ margin: 0 }}>Todavía no elegiste nada.</p>
              <Link href="/portal" className="btn btn-sm">
                Ver las variedades
              </Link>
            </div>
          ) : (
            <>
              <ul className="basket-list">
                {items.map((i) => (
                  <li key={i.strainId}>
                    <div className="basket-nombre">
                      <b>{nombre(i.strainId)}</b>
                      <span className="cell-meta tnum">
                        {g(i.gramos)}
                        {aportePorGramo != null ? ` · ${MONEY.format(aportePorGramo * i.gramos)}` : ""}
                      </span>
                    </div>
                    <div className="basket-cantidad">
                      <div className="cart-step" aria-label={`Gramos de ${nombre(i.strainId)}`}>
                        <button
                          type="button"
                          className="cart-step-btn"
                          onClick={() => delta(i.strainId, -5)}
                          aria-label={`Sacar 5 gramos de ${nombre(i.strainId)}`}
                        >
                          <Minus aria-hidden size={14} />
                        </button>
                        <span className="cart-step-num tnum">{i.gramos}</span>
                        <button
                          type="button"
                          className="cart-step-btn"
                          onClick={() => delta(i.strainId, +5)}
                          disabled={total + 5 > tope}
                          aria-label={`Sumar 5 gramos de ${nombre(i.strainId)}`}
                        >
                          <Plus aria-hidden size={14} />
                        </button>
                      </div>
                      <button type="button" className="basket-quitar" onClick={() => quitar(i.strainId)}>
                        <Trash2 aria-hidden size={14} /> Quitar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button type="button" className="drawer-quitar" style={{ marginTop: 10 }} onClick={vaciar}>
                Vaciar el basket
              </button>
            </>
          )}
        </div>
      </section>

      <aside className="panel basket-resumen" aria-label="Resumen del pedido">
        <div className="panel-body" style={{ display: "grid", gap: 10 }}>
          <div className="cart-linea">
            <span>Variedades</span>
            <span className="tnum">{items.length}</span>
          </div>
          <div className="cart-linea">
            <span>Gramos</span>
            <span className="tnum">{g(total)} de {g(tope)}</span>
          </div>
          <div className="cart-linea cart-linea--total">
            <span>Aporte estimado</span>
            <span className="tnum">{aporte != null ? MONEY.format(aporte) : "—"}</span>
          </div>
          <span className="cell-meta">El aporte se prorratea al entregar. Si elegís envío, el costo se suma en el paso siguiente.</span>

          {items.length > 0 && falta > 0 ? (
            <p className="note note-warn" style={{ margin: 0 }}>
              <span>
                El envío sale desde {g(minimoEnvioG)}: te faltan <b>{g(falta)}</b>. Podés retirar en el club sin mínimo.
              </span>
            </p>
          ) : null}
          {pasaTopeEnvio ? (
            <p className="note note-warn" style={{ margin: 0 }}>
              <span>Por envío salen hasta {g(topeEnvioG)}. Si querés más, va en dos pedidos.</span>
            </p>
          ) : null}

          <Link
            href={items.length > 0 ? "/portal#confirmar-pedido" : "/portal"}
            className="btn btn-lg btn-block"
            aria-disabled={items.length === 0}
            style={{ marginTop: 4 }}
          >
            {items.length > 0 ? "Continuar al envío" : "Elegir variedades"}
          </Link>
          <Link href="/portal" className="btn btn-quiet btn-block">
            Seguir eligiendo
          </Link>
        </div>
      </aside>
    </div>
  );
}
