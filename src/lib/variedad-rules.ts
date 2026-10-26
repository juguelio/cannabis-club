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
};

export type CepaCruda = {
  id: string;
  name: string;
  genetics: string | null;
  thcPct: unknown;
  cbdPct: unknown;
  active: boolean;
};

const dosDecimales = (v: unknown) => (v == null ? null : Math.round(Number(v) * 100) / 100);

/** Sólo activas, primero las que tienen stock, después por nombre. */
export function armarCatalogo(strains: CepaCruda[], gramosPorCepa: Map<string, number>): Variedad[] {
  return strains
    .filter((s) => s.active)
    .map((s) => ({
      id: s.id,
      nombre: s.name,
      genetica: s.genetics?.trim() || null,
      thc: dosDecimales(s.thcPct),
      cbd: dosDecimales(s.cbdPct),
      disponible: (gramosPorCepa.get(s.id) ?? 0) > 0,
    }))
    .sort((a, b) => Number(b.disponible) - Number(a.disponible) || a.nombre.localeCompare(b.nombre, "es"));
}
