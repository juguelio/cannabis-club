/**
 * Reglas de la re-validación de DNI + REPROCANN (puras: sin base, testeables).
 *
 * El socio que ya está en el padrón tiene que probar dos cosas antes de reservar o retirar: quién
 * es (DNI) y que puede recibir (REPROCANN vigente). La declaración es su dicho; el club mira los
 * documentos. Sin los tres archivos el trámite no entra a la cola, porque no hay nada que revisar.
 */

export type ProblemaCodigo =
  | "DNI_INVALIDO"
  | "NACIMIENTO_INVALIDO"
  | "MENOR_DE_EDAD"
  | "REPROCANN_INVALIDO"
  | "REPROCANN_VENCIDO"
  | "FALTAN_DOCUMENTOS";

export type Problema = { codigo: ProblemaCodigo; mensaje: string };

export type DeclaracionOk = { dni: string; nacimiento: Date; vence: Date };

export const DOCS_OBLIGATORIOS = ["DNI_FRENTE", "DNI_DORSO", "REPROCANN"] as const;
export type DocObligatorio = (typeof DOCS_OBLIGATORIOS)[number];

const DOC_LABEL: Record<DocObligatorio, string> = {
  DNI_FRENTE: "DNI (frente)",
  DNI_DORSO: "DNI (dorso)",
  REPROCANN: "credencial del REPROCANN",
};

/** El DNI se dicta con puntos, con espacios o pegado: se normaliza a dígitos antes de todo. */
export function normalizarDni(raw: string): string | null {
  const digitos = (raw ?? "").replace(/[^\d]/g, "");
  return digitos.length === 7 || digitos.length === 8 ? digitos : null;
}

const esFecha = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

const soloFechaUtc = (v: string) => new Date(`${v}T00:00:00.000Z`);

function edadEn(nacimiento: Date, hoy: Date): number {
  let edad = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
  const antes =
    hoy.getUTCMonth() < nacimiento.getUTCMonth() ||
    (hoy.getUTCMonth() === nacimiento.getUTCMonth() && hoy.getUTCDate() < nacimiento.getUTCDate());
  if (antes) edad -= 1;
  return edad;
}

export function validarDeclaracion(input: {
  dni: string;
  nacimiento: string;
  reprocann: string;
  vence: string;
  hoy?: Date;
  edadMinima?: number;
}): { ok: true; datos: DeclaracionOk } | { ok: false; problema: Problema } {
  const dni = normalizarDni(input.dni);
  if (!dni)
    return { ok: false, problema: { codigo: "DNI_INVALIDO", mensaje: "El DNI tiene que tener 7 u 8 números." } };

  if (!esFecha(input.nacimiento ?? ""))
    return { ok: false, problema: { codigo: "NACIMIENTO_INVALIDO", mensaje: "Falta la fecha de nacimiento." } };
  const nacimiento = soloFechaUtc(input.nacimiento);
  if (Number.isNaN(nacimiento.getTime()))
    return { ok: false, problema: { codigo: "NACIMIENTO_INVALIDO", mensaje: "La fecha de nacimiento no es válida." } };

  const hoy = input.hoy ?? new Date();
  if (nacimiento.getTime() > hoy.getTime())
    return { ok: false, problema: { codigo: "NACIMIENTO_INVALIDO", mensaje: "La fecha de nacimiento no puede ser futura." } };

  const edadMinima = input.edadMinima ?? 18;
  if (edadEn(nacimiento, hoy) < edadMinima)
    return {
      ok: false,
      problema: { codigo: "MENOR_DE_EDAD", mensaje: `El club asocia desde los ${edadMinima} años.` },
    };

  const reprocann = (input.reprocann ?? "").trim();
  if (reprocann.length < 4)
    return {
      ok: false,
      problema: { codigo: "REPROCANN_INVALIDO", mensaje: "Falta el número de REPROCANN (está en la credencial)." },
    };

  if (!esFecha(input.vence ?? ""))
    return { ok: false, problema: { codigo: "REPROCANN_INVALIDO", mensaje: "Falta la fecha de vencimiento del REPROCANN." } };
  const vence = soloFechaUtc(input.vence);
  if (Number.isNaN(vence.getTime()))
    return { ok: false, problema: { codigo: "REPROCANN_INVALIDO", mensaje: "La fecha de vencimiento no es válida." } };
  if (vence.getTime() < soloFechaUtc(hoy.toISOString().slice(0, 10)).getTime())
    return {
      ok: false,
      problema: {
        codigo: "REPROCANN_VENCIDO",
        mensaje: "Ese REPROCANN ya está vencido: subí la credencial del trámite renovado.",
      },
    };

  return { ok: true, datos: { dni, nacimiento, vence } };
}

/** Qué archivos faltan para poder presentar (y para que el club pueda aprobar). */
export function faltanDocumentos(tipos: string[]): DocObligatorio[] {
  const tiene = new Set(tipos);
  return DOCS_OBLIGATORIOS.filter((t) => !tiene.has(t));
}

export function textoFaltantes(faltan: DocObligatorio[]): string {
  if (faltan.length === 0) return "";
  if (faltan.length === 1) return `Falta ${DOC_LABEL[faltan[0]]}.`;
  return `Faltan ${faltan.map((f) => DOC_LABEL[f]).join(", ")}.`;
}

export type EstadoVerificacion = "PENDIENTE" | "EN_REVISION" | "VERIFICADO" | "RECHAZADO";

const ESTADOS: Record<EstadoVerificacion, { label: string; tone: "ok" | "warn" | "danger" | "mute"; detalle: string }> = {
  PENDIENTE: {
    label: "Falta validar",
    tone: "warn",
    detalle: "Todavía no presentaste tu DNI ni tu REPROCANN en la plataforma.",
  },
  EN_REVISION: {
    label: "En revisión",
    tone: "warn",
    detalle: "Recibimos tus datos y documentos. El club los está revisando.",
  },
  VERIFICADO: {
    label: "Validado",
    tone: "ok",
    detalle: "Tu DNI y tu REPROCANN están verificados.",
  },
  RECHAZADO: {
    label: "Para corregir",
    tone: "danger",
    detalle: "El club no pudo validar lo que presentaste. Corregí y volvé a enviar.",
  },
};

export function estadoVerificacion(estado: string) {
  return ESTADOS[(estado as EstadoVerificacion) in ESTADOS ? (estado as EstadoVerificacion) : "PENDIENTE"];
}

/** Sólo un legajo validado puede reservar, pedir envío o retirar. */
export const puedeOperar = (estado: string) => estado === "VERIFICADO";
