/**
 * Precios y aportes del club. Cada club configura su economía: cuántos gramos trae una membresía,
 * cuánto se aporta por membresía, cuántas entran por envío y qué sale por cada zona.
 *
 * Nunca se llaman "precios de venta": en un club de cultivo es prorrateo de costos. La app los usa
 * para calcular el aporte por gramo que carga en la cuenta corriente y para mostrar el catálogo.
 */
export type Envio = { zona: string; precioArs: number; demora: string; transportista?: string };
export type Producto = { nombre: string; precioArs: number; detalle?: string; activo: boolean };

export type Precios = {
  /** Gramos que trae una membresía (la cuota social mínima de retiro). */
  membresiaGramos: number;
  /** Aporte por membresía, en pesos. El aporte por gramo sale de dividir por `membresiaGramos`. */
  aporteMembresiaArs: number;
  /** Tope de membresías por envío o retiro. */
  maxMembresiasPorEnvio: number;
  envios: Envio[];
  productos: Producto[];
};

export const PRECIOS_POR_DEFECTO: Precios = {
  membresiaGramos: 10,
  aporteMembresiaArs: 0,
  maxMembresiasPorEnvio: 4,
  envios: [],
  productos: [],
};

/** Lo que el club puede editar; el resto (ids, fechas) no vive acá. */
export function preciosDeClub(club: { precios?: unknown; aportePorGramo?: unknown }): Precios {
  const crudo = (club.precios ?? {}) as Partial<Precios>;
  const gramos = num(crudo.membresiaGramos, PRECIOS_POR_DEFECTO.membresiaGramos);
  const maxEnv = num(crudo.maxMembresiasPorEnvio, PRECIOS_POR_DEFECTO.maxMembresiasPorEnvio);

  // Compatibilidad: los clubes viejos sólo tienen el aporte por gramo.
  const aporteGuardado = num(crudo.aporteMembresiaArs, 0);
  const porGramo = num(club.aportePorGramo, 0);
  const aporte = aporteGuardado > 0 ? aporteGuardado : porGramo > 0 ? porGramo * gramos : 0;

  return {
    membresiaGramos: gramos,
    aporteMembresiaArs: aporte,
    maxMembresiasPorEnvio: maxEnv,
    envios: Array.isArray(crudo.envios) ? crudo.envios.map((e) => ({
      zona: String(e?.zona ?? "").trim(),
      precioArs: num(e?.precioArs, 0),
      demora: String(e?.demora ?? "").trim(),
      transportista: e?.transportista ? String(e.transportista).trim() : undefined,
    })).filter((e) => e.zona) : [],
    productos: Array.isArray(crudo.productos) ? crudo.productos.map((p) => ({
      nombre: String(p?.nombre ?? "").trim(),
      precioArs: num(p?.precioArs, 0),
      detalle: p?.detalle ? String(p.detalle).trim() : undefined,
      activo: p?.activo !== false,
    })).filter((p) => p.nombre) : [],
  };
}

/** Aporte por gramo: lo que la cuenta corriente cobra en cada entrega. */
export function aportePorGramoDe(p: Precios): number | null {
  if (!(p.aporteMembresiaArs > 0) || !(p.membresiaGramos > 0)) return null;
  return Math.round((p.aporteMembresiaArs / p.membresiaGramos) * 100) / 100;
}

/** Gramos totales que entran en un envío, según el máximo de membresías. */
export function gramosPorEnvio(p: Precios): number {
  return Math.round(p.membresiaGramos * p.maxMembresiasPorEnvio * 100) / 100;
}

export type PreciosValidados = { ok: true; precios: Precios; aportePorGramo: number | null } | { ok: false; error: string };

/** Valida y normaliza lo que manda la pantalla. Los mensajes van al club, en su idioma. */
export function validarPrecios(input: unknown): PreciosValidados {
  if (!input || typeof input !== "object") return { ok: false, error: "No recibimos los precios." };
  const p = preciosDeClub({ precios: input });

  if (!(p.membresiaGramos > 0) || p.membresiaGramos > 40) return { ok: false, error: "Una membresía tiene que estar entre 1 y 40 gramos." };
  if (p.aporteMembresiaArs < 0) return { ok: false, error: "El aporte por membresía no puede ser negativo." };
  if (!Number.isInteger(p.maxMembresiasPorEnvio) || p.maxMembresiasPorEnvio < 1 || p.maxMembresiasPorEnvio > 10) {
    return { ok: false, error: "El máximo por envío tiene que ser un número entero entre 1 y 10." };
  }
  if (gramosPorEnvio(p) > 200) return { ok: false, error: "El total por envío no puede superar los 200 gramos." };
  if (p.envios.some((e) => e.precioArs < 0)) return { ok: false, error: "El costo de envío no puede ser negativo." };
  if (p.envios.length > 8) return { ok: false, error: "Cargá hasta 8 zonas de envío." };
  if (p.productos.length > 20) return { ok: false, error: "Cargá hasta 20 productos." };
  if (p.productos.some((x) => x.precioArs < 0)) return { ok: false, error: "El aporte de un producto no puede ser negativo." };

  return { ok: true, precios: p, aportePorGramo: aportePorGramoDe(p) };
}

function num(v: unknown, porDefecto: number): number {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : porDefecto;
}
