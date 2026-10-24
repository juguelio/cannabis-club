/**
 * Cambios de estado del socio (puro, testeado).
 * El consentimiento informado es requisito para tratar datos de salud: sin él no hay alta.
 */
export const MEMBER_STATUSES = ["PENDIENTE", "ACTIVO", "SUSPENDIDO", "BAJA"] as const;
export type MemberStatusValue = (typeof MEMBER_STATUSES)[number];

export type StatusDecision = { ok: true } | { ok: false; code: string; message: string };

export function evaluateStatusChange(input: {
  from: MemberStatusValue;
  to: MemberStatusValue;
  reason?: string | null;
  consentSigned: boolean;
}): StatusDecision {
  const reason = input.reason?.trim() ?? "";
  if (input.from === input.to) return { ok: false, code: "SAME_STATUS", message: "El socio ya está en ese estado." };
  if (input.to === "ACTIVO" && !input.consentSigned)
    return { ok: false, code: "CONSENT_REQUIRED", message: "Falta la fecha del consentimiento firmado: sin consentimiento no se puede activar al socio." };
  if ((input.to === "SUSPENDIDO" || input.to === "BAJA") && reason.length < 5)
    return { ok: false, code: "REASON_REQUIRED", message: input.to === "BAJA" ? "Indicá el motivo de la baja." : "Indicá el motivo de la suspensión." };
  if (input.from === "BAJA" && input.to !== "PENDIENTE")
    return { ok: false, code: "INVALID_TRANSITION", message: "Un socio dado de baja vuelve primero a pendiente de alta." };
  return { ok: true };
}
