/** Traducción de enums a lenguaje de club. Nunca mostrar el enum crudo. */

export type Tone = "ok" | "warn" | "danger" | "mute" | "brand";

export const MEMBER_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVO: { label: "Activo", tone: "ok" },
  PENDIENTE: { label: "Pendiente de alta", tone: "brand" },
  SUSPENDIDO: { label: "Suspendido", tone: "warn" },
  BAJA: { label: "Baja", tone: "mute" },
};

export const REPROCANN_STATUS: Record<string, { label: string; tone: Tone }> = {
  VIGENTE: { label: "REPROCANN vigente", tone: "ok" },
  EN_TRAMITE: { label: "REPROCANN en trámite", tone: "warn" },
  VENCIDO: { label: "REPROCANN vencido", tone: "danger" },
  NO_APORTA: { label: "Sin REPROCANN", tone: "danger" },
  RECHAZADO: { label: "REPROCANN rechazado", tone: "danger" },
};

export const APPOINTMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDIENTE: { label: "Reservado", tone: "brand" },
  CONFIRMADO: { label: "Confirmado", tone: "ok" },
  ATENDIDO: { label: "Atendido", tone: "mute" },
  AUSENTE: { label: "No vino", tone: "warn" },
  CANCELADO: { label: "Cancelado", tone: "mute" },
};

export const APPOINTMENT_CHANNEL: Record<string, string> = {
  MOSTRADOR: "En el club",
  TELEFONO: "Teléfono",
  WHATSAPP: "WhatsApp",
  WEB: "Web",
};

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export const CONSUMPTION: Record<string, string> = {
  LUDICO: "Lúdico",
  TERAPEUTICO: "Terapéutico",
};

export const STAGE: Record<string, { label: string; tone: Tone }> = {
  CUARENTENA: { label: "En cuarentena", tone: "warn" },
  PROPAGACION: { label: "Propagación", tone: "mute" },
  VEGETATIVO: { label: "Vegetativo", tone: "mute" },
  FLORACION: { label: "Floración", tone: "brand" },
  COSECHA: { label: "Cosecha", tone: "warn" },
  CURADO: { label: "Curado", tone: "warn" },
  DISPONIBLE: { label: "Disponible", tone: "ok" },
  AGOTADO: { label: "Agotado", tone: "mute" },
  DESTRUIDO: { label: "Destruido", tone: "danger" },
  RETIRADO: { label: "Retirado del mercado", tone: "danger" },
};

export const MOVEMENT: Record<string, string> = {
  INGRESO: "Ingreso por cosecha",
  AJUSTE_POSITIVO: "Ajuste positivo",
  AJUSTE_NEGATIVO: "Ajuste negativo",
  DISPENSACION: "Entrega a socio",
  DISPENSACION_REVERSA: "Contra-asiento de entrega",
  DESTRUCCION: "Destrucción",
  TRANSFERENCIA: "Transferencia",
};

export const ORIGIN: Record<string, string> = {
  SEMILLA: "Semilla",
  ESQUEJE: "Esqueje",
  COSECHA_PROPIA: "Cosecha propia",
  PROVEEDOR_EXTERNO: "Proveedor externo",
};

export const fmtGrams = (v: unknown) => {
  const n = Number(v ?? 0);
  return `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;
};

export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(d)) : "—";

const TZ = "America/Argentina/Buenos_Aires";

export const fmtDateTime = (d: Date | string) =>
  new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", hourCycle: "h23", timeZone: TZ }).format(new Date(d));

/** "hoy 14:20", "ayer 18:05" o "12/10 09:40", en hora del club. */
export function fmtWhen(d: Date | string, now = new Date()) {
  const date = new Date(d);
  const key = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(x);
  const time = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ }).format(date);
  if (key(date) === key(now)) return `hoy ${time}`;
  if (key(date) === key(new Date(now.getTime() - 86_400_000))) return `ayer ${time}`;
  const day = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "numeric", timeZone: TZ }).format(date);
  return `${day} ${time}`;
}

/** "sábado 24 de octubre" para una clave AAAA-MM-DD. */
export function fmtLongDay(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const age = (birth: Date | string) => {
  const b = new Date(birth);
  const now = new Date();
  const years = now.getUTCFullYear() - b.getUTCFullYear();
  const before = now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate());
  return before ? years - 1 : years;
};

/** Días hasta el vencimiento del REPROCANN (negativo = vencido). */
export const daysToExpiry = (d: Date | string | null | undefined) => {
  if (!d) return null;
  const target = new Date(d).getTime();
  return Math.ceil((target - Date.now()) / 86_400_000);
};

/** ¿Este socio tiene algo que regularizar antes de poder retirar? */
export function reprocannIssue(m: { reprocannStatus: string; reprocannExpiresAt: Date | string | null }) {
  if (m.reprocannStatus !== "VIGENTE") return REPROCANN_STATUS[m.reprocannStatus] ?? { label: m.reprocannStatus, tone: "danger" as Tone };
  const d = daysToExpiry(m.reprocannExpiresAt);
  if (d !== null && d < 0) return { label: "REPROCANN vencido", tone: "danger" as Tone };
  if (d !== null && d <= 30) return { label: `REPROCANN vence en ${d} días`, tone: "warn" as Tone };
  return { label: "REPROCANN vigente", tone: "ok" as Tone };
}

/** Acciones de la auditoría en lenguaje de club. */
export const AUDIT_ACTION: Record<string, string> = {
  LOGIN: "Ingresó",
  LOGIN_FAILED: "Intento de ingreso fallido",
  LOGOUT: "Salió",
  MEMBER_CREATE: "Alta de socio",
  MEMBER_UPDATE: "Editó el legajo",
  MEMBER_STATUS: "Cambió el estado del socio",
  MEMBER_IMPORT: "Importó el padrón",
  PORTAL_GRANT: "Dio acceso al portal",
  PORTAL_RESET: "Generó una clave nueva del portal",
  PORTAL_REVOKE: "Quitó el acceso al portal",
  BATCH_CREATE: "Creó un lote",
  BATCH_HARVEST: "Registró cosecha",
  BATCH_STAGE: "Cambió la etapa de un lote",
  BATCH_UPDATE: "Editó un lote",
  STRAIN_CREATE: "Creó una cepa",
  MOVEMENT_CREATE: "Registró un movimiento de stock",
  DISPENSATION_CREATE: "Registró una entrega",
  DISPENSATION_VOID: "Anuló una entrega",
  CLUB_UPDATE: "Cambió la configuración del club",
  CLUB_BRAND_UPDATE: "Cambió la marca del club",
  APPOINTMENT_CREATE: "Agendó un turno",
  PICKUP_CREATE: "Reserva desde el portal",
  PICKUP_CONFIRM: "Confirmó una reserva",
  PICKUP_REOPEN: "Devolvió el pedido a la cola al anular la entrega",
  PICKUP_CANCEL: "Canceló una reserva",
  PICKUP_PARTIAL: "Entregó distinto de lo reservado",
  USER_CREATE: "Creó una cuenta del equipo",
  USER_UPDATE: "Editó una cuenta del equipo",
  PAYMENT_PROOF_UPLOAD: "Subió el comprobante del aporte",
  PAYMENT_PROOF_VIEW: "Abrió un comprobante del aporte",
  PAYMENT_PROOF_APPROVE: "Aprobó el comprobante del aporte",
  PAYMENT_PROOF_REJECT: "Rechazó el comprobante del aporte",
  ACCESS_DOC_VIEW: "Abrió un documento del alta",
  ACCESS_DOC_UPLOAD: "Subió un documento del alta",
  MEMBER_VERIFICATION_SUBMIT: "Presentó su DNI y REPROCANN para validar el legajo",
  MEMBER_VERIFICATION_APPROVE: "Validó el DNI y el REPROCANN del legajo",
  MEMBER_VERIFICATION_REJECT: "Devolvió la validación para que el socio la corrija",
  ACCESS_DOC_RETENTION: "Purgó documentación vencida",
  ACCESS_REQUEST_APPROVE: "Aprobó un alta",
  ACCESS_REQUEST_REJECT: "Rechazó un alta",
  ACCESS_APPROVED_NOTICE: "Avisó que el alta fue aprobada",
  ACCESS_REJECTED_NOTICE: "Avisó que el alta fue rechazada",
  BATCH_RELEASE: "Liberó un lote",
  BATCH_RECALL: "Retiró un lote del circuito",
  CLOSED_DAY_ADD: "Cerró un día",
  CLOSED_DAY_REMOVE: "Reabrió un día cerrado",
  CONSENT_GRANT: "Registró un consentimiento",
  CONSENT_REVOKE: "Revocó un consentimiento",
  LOGIN_GOOGLE: "Ingresó con Google",
  MONTHLY_CLOSE: "Firmó el cierre mensual",
  SEMESTER_REPORT: "Firmó el informe semestral",
  NOTICE_SENT: "Registró un aviso al socio",
  SCHEDULE_RULE_ADD: "Abrió una franja de atención",
  SCHEDULE_RULE_UPDATE: "Editó una franja de atención",
  SHIPMENT_DISPATCH: "Despachó un envío",
  SHIPMENT_DELIVER: "Entregó un envío",
  SHIPMENT_CANCEL: "Canceló un envío",
  STRAIN_EDIT: "Editó una variedad",
  STRAIN_PHOTO: "Cambió la foto de una variedad",
  STRAIN_PHOTO_DELETE: "Quitó la foto de una variedad",
  USER_APPROVE: "Habilitó una cuenta del equipo",
  USER_PENDING: "Dejó una cuenta pendiente de aprobación",
  USER_REJECT: "Rechazó una cuenta del equipo",
};

/** Cómo se nombra la entidad sobre la que se actuó. */
export const AUDIT_ENTITY: Record<string, string> = {
  Member: "Socio",
  Batch: "Lote",
  Strain: "Variedad",
  Dispensation: "Entrega",
  PickupRequest: "Reserva",
  Appointment: "Turno",
  Club: "Club",
  User: "Cuenta del equipo",
  ClosedDay: "Día cerrado",
  MemberVerification: "Validación del legajo",
  VerificationDocument: "Documento de validación",
  MonthlyClose: "Cierre mensual",
  SemesterReport: "Informe semestral",
  Shipment: "Envío",
  AccessRequest: "Solicitud de alta",
  AccessDocument: "Documento del alta",
  Consent: "Consentimiento",
  StockMovement: "Movimiento de stock",
  ScheduleRule: "Franja de atención",
};

/** Código de auditoría en lenguaje de club; si falta la etiqueta, se humaniza en vez de mostrar el código. */
export const auditAction = (code: string) => AUDIT_ACTION[code] ?? code.replace(/_/g, " ").toLowerCase();
export const auditEntity = (code: string | null | undefined) => (code ? AUDIT_ENTITY[code] ?? code : "—");

/** Ingresos y salidas: no son actividad del club, van contados aparte para no tapar lo demás. */
export const AUDIT_SESSION = ["LOGIN", "LOGIN_GOOGLE", "LOGOUT"] as const;


export const FIELD_LABEL: Record<string, string> = {
  status: "estado", firstName: "nombre", lastName: "apellido", birthDate: "nacimiento", phone: "teléfono", email: "email",
  address: "domicilio", reprocannNumber: "N° REPROCANN", reprocannStatus: "estado REPROCANN", reprocannExpiresAt: "vencimiento REPROCANN",
  consentSignedAt: "consentimiento", consumptionType: "consumo", monthlyForecastG: "previsión", notes: "notas",
};

/** Cómo quedó firmada la entrega. REGISTRO_OPERADOR no prueba recepción del socio (R06). */
export const SIGNATURE: Record<string, string> = {
  REGISTRO_OPERADOR: "registrada por el operador",
  PIN: "PIN del socio",
  FIRMA_DIGITAL: "firma digital",
  QR: "QR del carnet",
};
