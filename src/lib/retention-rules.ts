/**
 * Reglas de retención, sin Prisma: los archivos de una solicitud rechazada no se
 * guardan para siempre. A los 30 días se borran; los del socio aprobado se conservan
 * porque son su legajo.
 */
export const DIAS_RETENCION_RECHAZO = 30;

/** Fecha de corte: todo lo rechazado antes de esto puede purgarse. */
export function corteRetencion(hoy = new Date(), dias = DIAS_RETENCION_RECHAZO) {
  return new Date(hoy.getTime() - dias * 24 * 3600 * 1000);
}

export type CandidataPurga = { id: string; status: string; reviewedAt: Date | null };

/** Qué solicitudes están en condiciones de purgarse. */
export function elegiblesParaPurga(solicitudes: CandidataPurga[], hoy = new Date(), dias = DIAS_RETENCION_RECHAZO) {
  const corte = corteRetencion(hoy, dias);
  return solicitudes
    .filter((s) => s.status === "RECHAZADA" && s.reviewedAt !== null && s.reviewedAt <= corte)
    .map((s) => s.id);
}
