/** Traducción de enums a lenguaje de club. Nunca mostrar el enum crudo. */

export type Tone = "ok" | "warn" | "danger" | "mute" | "brand";

export const MEMBER_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVO: { label: "Activo", tone: "ok" },
  PENDIENTE: { label: "Pendiente de alta", tone: "warn" },
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

export const CONSUMPTION: Record<string, string> = {
  LUDICO: "Lúdico",
  TERAPEUTICO: "Terapéutico",
};

export const STAGE: Record<string, { label: string; tone: Tone }> = {
  PROPAGACION: { label: "Propagación", tone: "mute" },
  VEGETATIVO: { label: "Vegetativo", tone: "mute" },
  FLORACION: { label: "Floración", tone: "brand" },
  COSECHA: { label: "Cosecha", tone: "warn" },
  CURADO: { label: "Curado", tone: "warn" },
  DISPONIBLE: { label: "Disponible", tone: "ok" },
  AGOTADO: { label: "Agotado", tone: "mute" },
  DESTRUIDO: { label: "Destruido", tone: "danger" },
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

export const fmtDateTime = (d: Date | string) =>
  new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(d));

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
