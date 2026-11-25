/**
 * Reglas del expediente de alta. Puras y sin Prisma: se pueden testear sin base.
 * El club sigue siendo el que decide; acá sólo se valida que la solicitud esté completa.
 */

export const AFFIDAVIT_VERSION = "2026-10";
export const MIN_EDAD = 18;
export const FALTA_NACIMIENTO = "Ingresá tu fecha de nacimiento.";
export const FALTA_VENCIMIENTO = "Ingresá la fecha de vencimiento de tu REPROCANN.";
export const CONFIRMAR_DECLARACION = "Para presentar la solicitud, confirmá la declaración.";
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

export type CampoFechaAlta = "birthDate" | "reprocannExpiresAt";

export function limitesFechasAlta(hoy = new Date()) {
  const anio = hoy.getUTCFullYear() - MIN_EDAD;
  const mes = hoy.getUTCMonth();
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const corte = new Date(Date.UTC(anio, mes, Math.min(hoy.getUTCDate(), ultimoDia)));
  return { hoy: hoy.toISOString().slice(0, 10), nacimientoMaximo: corte.toISOString().slice(0, 10) };
}

export function motivoFechaBloqueada(campo: CampoFechaAlta, dia: string, limites: ReturnType<typeof limitesFechasAlta>) {
  if (campo === "reprocannExpiresAt") {
    if (dia < limites.hoy) return "El REPROCANN está vencido: renovalo antes de presentarte.";
  } else {
    if (dia > limites.hoy) return "La fecha de nacimiento no puede ser futura.";
    if (dia > limites.nacimientoMaximo) return `Con la fecha ingresada todavía no cumpliste ${MIN_EDAD} años, la edad mínima para asociarte. Si el año está mal escrito, corregilo.`;
  }
}

const fecha = (v: string | Date | null | undefined) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (typeof v === "string" && d.toISOString().slice(0, 10) !== v) return null;
  return d;
};

/** Devuelve la lista de problemas; vacía significa que se puede presentar. */
export function validarSolicitud(input: SolicitudInput, hoy = new Date()): ErrorCampo[] {
  const errores: ErrorCampo[] = [];
  if (texto(input.firstName).length < 2) errores.push({ campo: "firstName", mensaje: "Escribí tu nombre con al menos dos caracteres." });
  if (texto(input.lastName).length < 2) errores.push({ campo: "lastName", mensaje: "Escribí tu apellido con al menos dos caracteres." });

  const nacimiento = fecha(input.birthDate);
  if (!nacimiento) errores.push({ campo: "birthDate", mensaje: input.birthDate ? "Revisá el día, mes y año de nacimiento." : FALTA_NACIMIENTO });
  else {
    const mensaje = motivoFechaBloqueada("birthDate", nacimiento.toISOString().slice(0, 10), limitesFechasAlta(hoy));
    if (mensaje) errores.push({ campo: "birthDate", mensaje });
  }

  const tel = soloDigitos(input.phone);
  if (/[^0-9 +().-]/.test(texto(input.phone))) errores.push({ campo: "phone", mensaje: "Ingresá el teléfono sin letras. Podés usar espacios, guiones, paréntesis y el signo +." });
  else if (tel.length < 8) errores.push({ campo: "phone", mensaje: "Ingresá el teléfono con código de área y al menos 8 números en total." });

  if (texto(input.address).length < 5) errores.push({ campo: "address", mensaje: "Ingresá tu domicilio con al menos cinco caracteres." });

  const dni = soloDigitos(input.docNumber);
  if (/[^0-9 .-]/.test(texto(input.docNumber))) errores.push({ campo: "docNumber", mensaje: "Ingresá los 7 u 8 dígitos del DNI sin letras." });
  else if (dni.length < DNI_MIN_DIGITOS || dni.length > DNI_MAX_DIGITOS)
    errores.push({ campo: "docNumber", mensaje: "El DNI tiene 7 u 8 dígitos." });

  if (soloDigitos(input.reprocannNumber).length < 4)
    errores.push({ campo: "reprocannNumber", mensaje: "El número de REPROCANN debe incluir al menos cuatro dígitos. Revisalo en tu credencial." });

  const vence = fecha(input.reprocannExpiresAt);
  if (!vence) errores.push({ campo: "reprocannExpiresAt", mensaje: input.reprocannExpiresAt ? "Revisá el día, mes y año de vencimiento del REPROCANN." : FALTA_VENCIMIENTO });
  else {
    const mensaje = motivoFechaBloqueada("reprocannExpiresAt", vence.toISOString().slice(0, 10), limitesFechasAlta(hoy));
    if (mensaje) errores.push({ campo: "reprocannExpiresAt", mensaje });
  }

  if (!input.affidavitAccepted) errores.push({ campo: "affidavitAccepted", mensaje: CONFIRMAR_DECLARACION });

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
