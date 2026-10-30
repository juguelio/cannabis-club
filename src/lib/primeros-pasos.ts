/**
 * Primeros pasos de un club que arranca: lo que falta para que la app sirva de verdad.
 * No es un tutorial: cada línea se cumple cuando el estado real cambia, y desaparece cuando ya está.
 */
export type EstadoArranque = {
  /** Datos legales sin completar (ver `faltantesLegales`). */
  legalesFaltantes: number;
  /** Variedades publicadas en el catálogo. */
  variedades: number;
  /** Cuentas de equipo con email institucional (no de prueba). */
  equipoReal: number;
  /** Lotes cargados en stock. */
  lotes: number;
  /** Socios en el padrón. */
  socios: number;
};

export type Paso = { key: string; label: string; hint: string; href: string; hecho: boolean };

/** Dominios de prueba con los que se armó la demo: no deben quedar en la cuenta del club. */
const DOMINIOS_DE_PRUEBA = ["club.test", "example.com", "test.local"];

export function esEmailDePrueba(email: string): boolean {
  const dominio = email.split("@")[1]?.toLowerCase() ?? "";
  return DOMINIOS_DE_PRUEBA.some((d) => dominio === d || dominio.endsWith(`.${d}`));
}

export function primerosPasos(e: EstadoArranque): Paso[] {
  return [
    {
      key: "legales",
      label: "Completar los datos legales",
      hint: e.legalesFaltantes > 0 ? `${e.legalesFaltantes} sin cargar` : "Listo",
      href: "/configuracion?seccion=legales",
      hecho: e.legalesFaltantes === 0,
    },
    {
      key: "equipo",
      label: "Poner las cuentas del club",
      hint: e.equipoReal === 0 ? "Hoy hay cuentas de prueba" : "Listo",
      href: "/configuracion?seccion=equipo",
      hecho: e.equipoReal > 0,
    },
    {
      key: "catalogo",
      label: "Cargar variedades con foto",
      hint: e.variedades > 0 ? "Listo" : "Sin variedades",
      href: "/configuracion?seccion=catalogo",
      hecho: e.variedades > 0,
    },
    {
      key: "lote",
      label: "Cargar el primer lote",
      hint: e.lotes > 0 ? "Listo" : "El stock nace de un lote",
      href: "/stock",
      hecho: e.lotes > 0,
    },
    {
      key: "socio",
      label: "Tener el primer socio aprobado",
      hint: e.socios > 0 ? "Listo" : "Se aprueba desde Altas",
      href: "/socios?ver=altas",
      hecho: e.socios > 0,
    },
  ];
}

export function progresoArranque(pasos: Paso[]): { hechos: number; total: number; completo: boolean } {
  const hechos = pasos.filter((p) => p.hecho).length;
  return { hechos, total: pasos.length, completo: hechos === pasos.length };
}
