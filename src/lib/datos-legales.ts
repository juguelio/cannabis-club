/**
 * Datos que sólo el club puede declarar y que sostienen los libros, el informe semestral y la inspección.
 * La pantalla los junta y el panel recuerda los que faltan: nadie los inventa por el club.
 */
export type DatoLegal = {
  campo: "nombre" | "cuit" | "personeria" | "reps" | "domicilioLegal" | "reprocannNumber" | "directorMedico" | "directorMedicoMatricula" | "responsableTecnico" | "responsableTecnicoTitulo";
  label: string;
  /** Dónde se usa el dato, para que quien lo carga sepa por qué le importa. */
  para: string;
  /** Un ejemplo del formato esperado: va de placeholder, nunca como valor. */
  ejemplo: string;
};

export const DATOS_LEGALES: DatoLegal[] = [
  { campo: "nombre", label: "Nombre legal de la asociación", para: "Libros y comprobantes", ejemplo: "Asociación Civil …" },
  { campo: "cuit", label: "CUIT", para: "Libros y comprobantes", ejemplo: "30-71234567-8" },
  { campo: "personeria", label: "Personería jurídica", para: "Informe semestral", ejemplo: "Res. IGJ 1234 del 12/03/2024" },
  { campo: "reps", label: "REPS (registro provincial)", para: "Inspección", ejemplo: "REPS Santa Fe 1234" },
  { campo: "domicilioLegal", label: "Domicilio legal", para: "Informe semestral", ejemplo: "Calle, número, localidad, provincia" },
  { campo: "reprocannNumber", label: "Inscripción del club en el REPROCANN", para: "Autorización de cultivo", ejemplo: "Número de inscripción y código de vinculación" },
  { campo: "directorMedico", label: "Director médico", para: "Res. 1780/2025", ejemplo: "Nombre y apellido" },
  { campo: "directorMedicoMatricula", label: "Matrícula del director médico", para: "Res. 1780/2025", ejemplo: "MN 12345" },
  { campo: "responsableTecnico", label: "Responsable técnico", para: "Res. 1780/2025", ejemplo: "Nombre y apellido" },
  { campo: "responsableTecnicoTitulo", label: "Título del responsable técnico", para: "Res. 1780/2025", ejemplo: "Farmacéutico, Ingeniero agrónomo…" },
];

/**
 * Valores que trajo la demo. Cuentan como faltantes: un CUIT `30-00000000-0` en un libro es peor que un campo vacío,
 * porque parece completo y nadie lo revisa.
 */
const PLACEHOLDER = /(demo|0000|ejemplo|xxx|completar)/i;

export function valorDeDemo(valor: string | null | undefined): boolean {
  const v = (valor ?? "").trim();
  if (!v) return false;
  return PLACEHOLDER.test(v);
}

/** Los que todavía están vacíos o siguen con el valor de la demo, con el motivo por el que hacen falta. */
export function faltantesLegales(club: Partial<Record<DatoLegal["campo"], string | null>>): DatoLegal[] {
  return DATOS_LEGALES.filter((d) => {
    const v = club[d.campo];
    return v == null || String(v).trim() === "" || valorDeDemo(v);
  });
}

/** Un solo texto para el recordatorio del panel. */
export function recordatorioLegal(faltantes: DatoLegal[]): string {
  if (faltantes.length === 0) return "";
  if (faltantes.length === 1) return `Falta un dato legal: ${faltantes[0].label}.`;
  return `Faltan ${faltantes.length} datos legales del club. Se completan una vez y quedan en los libros.`;
}
