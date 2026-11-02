/**
 * Reglas del expediente de alta. Puras y sin Prisma: se pueden testear sin base.
 * El club sigue siendo el que decide; acá sólo se valida que la solicitud esté completa.
 */

export const AFFIDAVIT_VERSION = "2026-10";
export const MIN_EDAD = 18;
export const DNI_MIN_DIGITOS = 7;
export const DNI_MAX_DIGITOS = 8;

export const AFFIDAVIT_TEXTO =
  "Declaro que los datos y la documentación que presento son verdaderos, que soy mayor de edad y que el cultivo " +
  "del club es para mi consumo personal en el marco de la Ley 27.350 y el REPROCANN. Autorizo al club a verificar " +
  "la documentación y entiendo que el alta queda sujeta a su aprobación.";

export type EstadoSolicitud = "PENDIENTE" | "APROBADA" | "RECHAZADA";

export type SolicitudInput = {
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: string | Date | null;
  phone?: string | null;
  address?: string | null;
  locality?: string | null;
  docNumber?: string | null;
  reprocannNumber?: string | null;
  reprocannExpiresAt?: string | Date | null;
  consumptionType?: string | null;
  affidavitAccepted?: boolean | null;
};

export type ErrorCampo = { campo: string; mensaje: string };

const texto = (v: unknown) => String(v ?? "").trim();
export const soloDigitos = (v: unknown) => texto(v).replace(/\D/g, "");

/** Edad cumplida a la fecha de referencia. */
export function edadEn(nacimiento: Date, hoy: Date) {
  let edad = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
  const mes = hoy.getUTCMonth() - nacimiento.getUTCMonth();
  if (mes < 0 || (mes === 0 && hoy.getUTCDate() < nacimiento.getUTCDate())) edad -= 1;
  return edad;
}

const fecha = (v: string | Date | null | undefined) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Devuelve la lista de problemas; vacía significa que se puede presentar. */
export function validarSolicitud(input: SolicitudInput, hoy = new Date()): ErrorCampo[] {
  const errores: ErrorCampo[] = [];
  if (texto(input.firstName).length < 2) errores.push({ campo: "firstName", mensaje: "Poné tu nombre." });
  if (texto(input.lastName).length < 2) errores.push({ campo: "lastName", mensaje: "Poné tu apellido." });

  const nacimiento = fecha(input.birthDate);
  if (!nacimiento) errores.push({ campo: "birthDate", mensaje: "Falta la fecha de nacimiento." });
  else {
    if (nacimiento > hoy) errores.push({ campo: "birthDate", mensaje: "La fecha de nacimiento no puede ser futura." });
    else if (edadEn(nacimiento, hoy) < MIN_EDAD) errores.push({ campo: "birthDate", mensaje: `Tenés que ser mayor de ${MIN_EDAD} años.` });
  }

  const tel = soloDigitos(input.phone);
  if (tel.length < 8) errores.push({ campo: "phone", mensaje: "Poné un teléfono con código de área." });

  if (texto(input.address).length < 5) errores.push({ campo: "address", mensaje: "Falta el domicilio." });

  const dni = soloDigitos(input.docNumber);
  if (dni.length < DNI_MIN_DIGITOS || dni.length > DNI_MAX_DIGITOS)
    errores.push({ campo: "docNumber", mensaje: "El DNI tiene 7 u 8 dígitos." });

  if (soloDigitos(input.reprocannNumber).length < 4)
    errores.push({ campo: "reprocannNumber", mensaje: "Falta el número de REPROCANN." });

  const vence = fecha(input.reprocannExpiresAt);
  if (!vence) errores.push({ campo: "reprocannExpiresAt", mensaje: "Falta el vencimiento del REPROCANN." });
  else if (vence < new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())))
    errores.push({ campo: "reprocannExpiresAt", mensaje: "El REPROCANN está vencido: renovalo antes de presentarte." });

  if (!input.affidavitAccepted) errores.push({ campo: "affidavitAccepted", mensaje: "Tenés que aceptar la declaración jurada." });

  return errores;
}

export const DOCS_OBLIGATORIOS = ["DNI_FRENTE", "DNI_DORSO", "REPROCANN"] as const;

/** Qué le falta al expediente para poder aprobarse. */
export function faltantesParaAprobar(params: {
  status: EstadoSolicitud;
  tiposCargados: string[];
  docLast4?: string | null;
}) {
  const faltan: string[] = [];
  if (params.status !== "PENDIENTE") faltan.push("La solicitud ya está resuelta.");
  for (const tipo of DOCS_OBLIGATORIOS) if (!params.tiposCargados.includes(tipo)) faltan.push(`Falta el archivo: ${tipo}.`);
  if (!params.docLast4) faltan.push("Falta el documento declarado.");
  return faltan;
}

/** Motivo de rechazo obligatorio y con contenido: el rechazo se le muestra a la persona. */
export function validarRechazo(motivo: string | null | undefined) {
  const t = texto(motivo);
  if (t.length < 10) return "Escribí el motivo del rechazo (mínimo 10 caracteres): la persona lo va a leer.";
  if (t.length > 500) return "El motivo no puede superar los 500 caracteres.";
  return null;
}

/** Legajo siguiente: el mayor + 1. Los legajos no se reutilizan. */
/**
 * Reclamo de un legajo que ya está en el padrón (socios que vinieron de la planilla).
 *
 * El alta normal crea el legajo; el reclamo lo completa. Dos consecuencias que se deciden acá y no en la ruta:
 * un documento que ya figura en ese mismo legajo no es un duplicado, y un legajo que ya tiene cuenta no se reclama.
 */
export function esReclamoDeLegajo(params: { emailPadron: string | null; emailCuenta: string; yaTieneCuenta: boolean }) {
  if (params.yaTieneCuenta || !params.emailPadron) return false;
  return params.emailPadron.trim().toLowerCase() === params.emailCuenta.trim().toLowerCase();
}

export function esDocumentoDelMismoLegajo(params: { legajoDelDocumento: number | null; legajoReclamado: number | null }) {
  return params.legajoDelDocumento != null && params.legajoDelDocumento === params.legajoReclamado;
}

export function legajoSiguiente(legajos: number[]) {
  return legajos.length ? Math.max(...legajos) + 1 : 1;
}

export const ESTADO_TEXTO: Record<EstadoSolicitud, string> = {
  PENDIENTE: "El club está revisando tu documentación",
  APROBADA: "Solicitud aprobada: ya sos socio",
  RECHAZADA: "Solicitud rechazada",
};

export const ESTADO_DETALLE: Record<EstadoSolicitud, string> = {
  PENDIENTE:
    "Recibimos tu solicitud y la documentación. Una persona del club va a revisar el DNI y el REPROCANN; " +
    "cuando esté aprobada, tu cuenta se habilita y vas a poder entrar al portal del socio.",
  APROBADA: "Tu legajo está creado. Entrá con Google para ver tu carnet, tus topes y pedir turno.",
  RECHAZADA: "Revisá el motivo y volvé a presentar la solicitud con la documentación corregida.",
};
