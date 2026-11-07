"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { faltaParaMinimo } from "@/lib/envios";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const g = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;

export type BasketPanelProps = {
  items: { strainId: string; gramos: number }[];
  total: number;
  tope: number;
  aportePorGramo: number | null;
  minimoEnvioG: number;
  topeEnvioG: number;
  nombreDe: Record<string, string>;
  onDelta: (strainId: string, paso: number) => void;
  onQuitar: (strainId: string) => void;
  onVaciar: () => void;
  /** Zona que le toca por CP, para decir cuánto se suma si elige envío. */
  envioZona?: { zona: string; precioArs: number } | null;
};

/**
 * El basket fijo al costado del catálogo, en escritorio.
 *
 * Es el panel de la maqueta: renglones, gramos sobre el tope, aporte, barra hasta el mínimo de envío y
 * un solo botón. En celular no se muestra —lo reemplaza la barra de abajo—, porque un panel sticky en
 * una pantalla de 390 px se come el catálogo.
 */
export function BasketPanel({
  items,
  total,
  tope,
  aportePorGramo,
  minimoEnvioG,
  topeEnvioG,
  nombreDe,
  onDelta,
  onQuitar,
  onVaciar,
  envioZona,
}: BasketPanelProps) {
  const nombre = (id: string) => nombreDe[id] ?? "Variedad";
  const aporte = aportePorGramo != null ? aportePorGramo * total : null;
  const falta = faltaParaMinimo(total, minimoEnvioG);
  const pasaTopeEnvio = total > topeEnvioG + 1e-9;
  const pctMinimo = minimoEnvioG > 0 ? Math.min(100, (total / minimoEnvioG) * 100) : 100;

  return (
    <aside className="basket-panel" aria-label="Tu basket">
      <div className="basket-panel-head">
        <b>Tu basket</b>
        {items.length ? (
          <button type="button" className="basket-panel-vaciar" onClick={onVaciar}>
            Vaciar
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="basket-panel-vacio">
          <ShoppingBasket aria-hidden size={18} /> Elegí una variedad y sumá gramos.
        </p>
      ) : (
        <ul className="basket-panel-list">
          {items.map((i) => (
            <li key={i.strainId}>
              <div className="basket-panel-renglon">
                <span>
                  {nombre(i.strainId)}
                  <small className="tnum">{g(i.gramos)}</small>
                </span>
                <span className="tnum">{aportePorGramo != null ? MONEY.format(aportePorGramo * i.gramos) : "—"}</span>
              </div>
              <div className="basket-panel-acciones">
                <div className="cart-step" aria-label={`Gramos de ${nombre(i.strainId)}`}>
                  <button type="button" className="cart-step-btn" onClick={() => onDelta(i.strainId, -5)} aria-label={`Sacar 5 gramos de ${nombre(i.strainId)}`}>
                    <Minus aria-hidden size={13} />
                  </button>
                  <span className="cart-step-num tnum">{i.gramos}</span>
                  <button
                    type="button"
                    className="cart-step-btn"
                    onClick={() => onDelta(i.strainId, 5)}
                    disabled={total + 5 > tope}
                    aria-label={`Sumar 5 gramos de ${nombre(i.strainId)}`}
                  >
                    <Plus aria-hidden size={13} />
                  </button>
                </div>
                <button type="button" className="basket-panel-quitar" onClick={() => onQuitar(i.strainId)} aria-label={`Quitar ${nombre(i.strainId)}`}>
                  <Trash2 aria-hidden size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="basket-panel-datos">
        <div className="cart-linea">
          <span>Gramos</span>
          <span className="tnum">{g(total)} de {g(tope)}</span>
        </div>
        <div className="cart-linea cart-linea--total">
          <span>Aporte</span>
          <span className="tnum">{aporte != null ? MONEY.format(aporte) : "—"}</span>
        </div>
      </div>

      {items.length > 0 && minimoEnvioG > 0 ? (
        <div className="basket-panel-minimo">
          <span className="basket-panel-barra" aria-hidden>
            <span style={{ width: `${pctMinimo}%` }} />
          </span>
          <small>
            {falta > 0 ? (
              <>Para envío faltan <b>{g(falta)}</b> · retiro sin mínimo.</>
            ) : (
              <>Llega al mínimo de envío ({g(minimoEnvioG)}).</>
            )}
          </small>
        </div>
      ) : null}

      {pasaTopeEnvio ? (
        <p className="note note-warn" style={{ margin: 0 }}>
          <span>Por envío salen hasta {g(topeEnvioG)}. Si querés más, va en dos pedidos.</span>
        </p>
      ) : null}

      {items.length > 0 && envioZona ? (
        <span className="basket-panel-nota">
          Si lo pedís con envío a {envioZona.zona} se suman {MONEY.format(envioZona.precioArs)}.
        </span>
      ) : null}

      <Link
        href={items.length > 0 ? "/portal/pedido" : "/portal"}
        className="btn btn-lg btn-block"
        aria-disabled={items.length === 0}
      >
        {items.length > 0 ? `Continuar · ${aporte != null ? MONEY.format(aporte) : g(total)}` : "Elegir variedades"}
      </Link>
      <span className="basket-panel-nota">Elegís retiro o envío en el paso siguiente.</span>
    </aside>
  );
}
