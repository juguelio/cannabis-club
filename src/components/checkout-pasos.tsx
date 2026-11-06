import { Check } from "lucide-react";

const PASOS = ["Entrega", "Pago", "Confirmado"] as const;

/**
 * Dónde está parado el socio, en una línea.
 *
 * No es una barra de tres bloques: cada paso ya es una página y el navegador de arriba dice dónde está.
 * Esto sólo aclara que hay un antes y un después, para que avanzar no se sienta como una pantalla más.
 */
export function PasosPedido({ actual }: { actual: 1 | 2 | 3 }) {
  return (
    <ol className="pasos" aria-label="Pasos del pedido">
      {PASOS.map((p, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const estado = actual === n ? "actual" : actual > n ? "hecho" : "pendiente";
        return (
          <li key={p} className={`paso paso--${estado}`} aria-current={estado === "actual" ? "step" : undefined}>
            <span className="paso-num">{estado === "hecho" ? <Check aria-hidden size={13} /> : n}</span>
            <span>{p}</span>
          </li>
        );
      })}
    </ol>
  );
}
