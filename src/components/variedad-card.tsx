import { Leaf, Minus, Plus } from "lucide-react";
import type { Variedad } from "@/lib/variedad-rules";

/**
 * Tarjeta del catálogo: foto del producto (o recuadro provisorio mientras el club no la subió),
 * nombre, genética, THC/CBD, lote y stock, más las cantidades rápidas.
 *
 * No muestra precios de venta: muestra el **aporte de cultivo** que corresponde a cada cantidad, porque
 * el socio decide cuánto llevarse sabiendo cuánto le suma. La app no es un mostrador y el club no vende.
 * Se usa igual en el sitio público (sin carrito) y en el portal del socio.
 */

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const g = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;

/** Las cantidades que el club ofrece de un toque. El paso del contador sigue siendo 5 g. */
export const CANTIDADES_RAPIDAS = [5, 10, 20] as const;

export type CarritoCard = {
  gramos: number;
  puedeSubir: boolean;
  /** Cuánto puede sumar todavía sin pasarse del tope ni del stock. */
  restante: number;
  aportePorGramo: number | null;
  onDelta: (paso: number) => void;
  onSet: (gramos: number) => void;
  onQuitar: () => void;
};

export function VariedadCard({
  v,
  tone = "light",
  carrito,
}: {
  v: Variedad;
  tone?: "light" | "site";
  /** En el portal la tarjeta suma gramos; en el sitio público sólo muestra el catálogo. */
  carrito?: CarritoCard;
}) {
  const borde = tone === "site" ? "color-mix(in srgb, currentColor 18%, transparent)" : "var(--line)";
  const suave = tone === "site" ? "color-mix(in srgb, currentColor 7%, transparent)" : "var(--surface, #fff)";
  const enBasket = carrito?.gramos ?? 0;

  // Una cantidad rápida no se ofrece si no entra: ni por stock de la cepa ni por el tope del socio.
  const disponibleParaSumar = carrito ? Math.min(carrito.restante, v.stockG) + enBasket : 0;
  const aporte = (gramos: number) =>
    carrito?.aportePorGramo != null ? MONEY.format(carrito.aportePorGramo * gramos) : null;

  return (
    <div
      className={`vcard${v.disponible ? "" : " vcard--agotada"}`}
      style={{
        border: `1px ${v.disponible ? "solid" : "dashed"} ${borde}`,
        borderRadius: 14,
        overflow: "hidden",
        opacity: v.disponible ? 1 : 0.82,
        background: suave,
      }}
    >
      <div className="vcard-foto">
        {v.foto ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={v.foto} alt={v.nombre} />
        ) : (
          <div className="vcard-foto--vacia">
            <Leaf aria-hidden style={{ width: 26, height: 26 }} />
            <small>Foto provisoria</small>
          </div>
        )}
        {enBasket > 0 ? <span className="vcard-badge">{g(enBasket)} en tu basket</span> : null}
      </div>

      <div className="vcard-body">
        <div className="vcard-top">
          <b className="vcard-nombre">{v.nombre}</b>
          {v.disponible ? <span className="vcard-stock tnum">{Math.round(v.stockG)} g en stock</span> : null}
        </div>

        <div className="vcard-datos">
          {v.genetica ? <span className="vcard-tag">{v.genetica}</span> : null}
          {v.thc != null ? <span className="vcard-tag">THC {v.thc} %</span> : null}
          {v.cbd != null ? <span className="vcard-tag">CBD {v.cbd} %</span> : null}
          {v.lote ? <span className="vcard-tag vcard-tag--lote">Lote {v.lote}</span> : null}
        </div>

        {carrito && v.disponible ? (
          <>
            <div className="vcard-rapidas" role="group" aria-label={`Cuánto llevar de ${v.nombre}`}>
              {CANTIDADES_RAPIDAS.filter((n) => n <= disponibleParaSumar + 1e-9).map((n) => (
                <button
                  key={n}
                  type="button"
                  className="vcard-rapida"
                  aria-pressed={enBasket === n}
                  onClick={() => carrito.onSet(n)}
                >
                  <b className="tnum">{n} g</b>
                  {aporte(n) ? <small className="tnum">{aporte(n)}</small> : null}
                </button>
              ))}
            </div>

            <div className="vcard-pie">
              <div className="cart-step" role="group" aria-label={`Gramos de ${v.nombre}`}>
                <button
                  type="button"
                  className="cart-step-btn"
                  onClick={() => carrito.onDelta(-5)}
                  disabled={enBasket <= 0}
                  aria-label={`Sacar 5 gramos de ${v.nombre}`}
                >
                  <Minus aria-hidden size={14} />
                </button>
                <span className="cart-step-num tnum" aria-live="polite">
                  {enBasket > 0 ? g(enBasket) : "—"}
                </span>
                <button
                  type="button"
                  className="cart-step-btn"
                  onClick={() => carrito.onDelta(5)}
                  disabled={!carrito.puedeSubir}
                  aria-label={`Agregar 5 gramos de ${v.nombre}`}
                >
                  <Plus aria-hidden size={14} />
                </button>
              </div>
              {enBasket > 0 ? (
                <button type="button" className="vcard-quitar" onClick={carrito.onQuitar}>
                  Quitar
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
