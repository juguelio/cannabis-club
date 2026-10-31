/**
 * Cotización del dólar para los clubes que fijan el aporte en USD.
 *
 * El aporte se cobra siempre en pesos: la cotización sólo convierte. Se consulta a dolarapi.com
 * (sin clave) y se guarda el valor con la fecha, para que el club pueda ver de dónde salió el número
 * que se usó. La elección de la fuente es del club: oficial, blue, bolsa o un valor cargado a mano.
 */
export type FuenteCotizacion = "oficial" | "blue" | "bolsa" | "manual";

export type Cotizacion = {
  fuente: FuenteCotizacion;
  /** Pesos por dólar. 0 = todavía no se actualizó. */
  valor: number;
  /** ISO de cuándo se trajo el valor (null si nunca). */
  actualizadaAt: string | null;
};

export const COTIZACION_VACIA: Cotizacion = { fuente: "blue", valor: 0, actualizadaAt: null };

/** Cómo se llama cada fuente para el club. */
export const FUENTES: { key: FuenteCotizacion; label: string }[] = [
  { key: "oficial", label: "Oficial" },
  { key: "blue", label: "Blue" },
  { key: "bolsa", label: "MEP / Bolsa" },
  { key: "manual", label: "La cargo a mano" },
];

export type FilaDolar = { casa?: string; nombre?: string; compra?: number | null; venta?: number | null; fechaActualizacion?: string };

/**
 * Elige la cotización de la lista que devuelve dolarapi.com. Se usa el **venta** (es lo que paga el
 * socio) y, si no hay venta, la compra. Devuelve 0 cuando la fuente pedida no vino en la lista: mejor
 * un cero visible que un número inventado.
 */
export function cotizacionDeLista(filas: unknown, fuente: FuenteCotizacion): Cotizacion {
  if (!Array.isArray(filas)) return { ...COTIZACION_VACIA, fuente };
  const fila = filas.find((f) => (f as FilaDolar)?.casa === fuente) as FilaDolar | undefined;
  if (!fila) return { ...COTIZACION_VACIA, fuente };
  const valor = Number(fila.venta ?? fila.compra ?? 0);
  return {
    fuente,
    valor: Number.isFinite(valor) && valor > 0 ? valor : 0,
    actualizadaAt: fila.fechaActualizacion ?? new Date().toISOString(),
  };
}

/** Etiqueta corta para mostrar en la pantalla. */
export function cotizacionLegible(c: Cotizacion): string {
  if (!(c.valor > 0)) return "Sin cotización cargada";
  const nombre = FUENTES.find((f) => f.key === c.fuente)?.label ?? c.fuente;
  const cuando = c.actualizadaAt ? new Date(c.actualizadaAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : null;
  return cuando ? `${nombre}: $${c.valor.toLocaleString("es-AR")} (${cuando})` : `${nombre}: $${c.valor.toLocaleString("es-AR")}`;
}
