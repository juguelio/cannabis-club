/**
 * Catálogo de variedades, sin Prisma: reglas puras del armado.
 * La app no es un mostrador: se muestra qué cultiva el club y si hay stock, nunca un precio.
 */
export type Variedad = {
  id: string;
  nombre: string;
  genetica: string | null;
  thc: number | null;
  cbd: number | null;
  disponible: boolean;
  /** Gramos disponibles hoy de esa cepa. Se muestra en la tarjeta: el socio sabe si alcanza. */
  stockG: number;
  /** Lote que se entrega hoy (el más reciente disponible), para poder rastrearlo. */
  lote: string | null;
  /** URL de la foto del producto; sin foto el catálogo muestra un recuadro provisorio. */
  foto: string | null;
};

export type CepaCruda = {
  id: string;
  name: string;
  genetics: string | null;
  thcPct: unknown;
  cbdPct: unknown;
  active: boolean;
  /** 0 = sin foto. Se usa para invalidar la caché cuando cambia. */
  fotoVersion?: number;
};

const dosDecimales = (v: unknown) => (v == null ? null : Math.round(Number(v) * 100) / 100);

/** Sólo activas, primero las que tienen stock, después por nombre. */
export function armarCatalogo(
  strains: CepaCruda[],
  gramosPorCepa: Map<string, number>,
  lotePorCepa: Map<string, string> = new Map(),
): Variedad[] {
  return strains
    .filter((s) => s.active)
    .map((s) => ({
      id: s.id,
      nombre: s.name,
      genetica: s.genetics?.trim() || null,
      thc: dosDecimales(s.thcPct),
      cbd: dosDecimales(s.cbdPct),
      disponible: (gramosPorCepa.get(s.id) ?? 0) > 0,
      stockG: Math.max(0, Math.round((gramosPorCepa.get(s.id) ?? 0) * 10) / 10),
      lote: lotePorCepa.get(s.id) ?? null,
      foto: (s.fotoVersion ?? 0) > 0 ? `/api/variedades/${s.id}/foto?v=${s.fotoVersion}` : null,
    }))
    .sort((a, b) => Number(b.disponible) - Number(a.disponible) || a.nombre.localeCompare(b.nombre, "es"));
}
