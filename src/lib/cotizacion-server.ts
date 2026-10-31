import { cotizacionDeLista, type Cotizacion, type FuenteCotizacion } from "./cotizacion";

/**
 * Trae la cotización del día. `manual` no consulta a nadie: usa el valor que manda el club.
 * Si la red falla devuelve valor 0 en vez de lanzar, para que el que llama decida (el POST lo
 * rechaza, el cron lo registra y sigue).
 */
export async function traerCotizacion(fuente: FuenteCotizacion, manual?: number): Promise<Cotizacion> {
  if (fuente === "manual") {
    return { fuente, valor: manual && manual > 0 ? manual : 0, actualizadaAt: new Date().toISOString() };
  }
  let filas: unknown = null;
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares", { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (res.ok) filas = await res.json();
  } catch {
    filas = null;
  }
  return cotizacionDeLista(filas, fuente);
}
