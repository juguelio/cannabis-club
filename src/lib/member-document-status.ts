type DocumentState = {
  reprocannStatus: string;
  reprocannOk: boolean;
  reprocannDays: number | null;
};

/** Presentation only: never changes eligibility or the stored record. */
export function memberDocumentStatus(member: DocumentState) {
  const days = member.reprocannDays;
  if (member.reprocannStatus === "VIGENTE" && member.reprocannOk) {
    if (days == null) return { label: "Vigente · sin fecha de vencimiento cargada", attention: true };
    if (days === 0) return { label: "Vence hoy", attention: true };
    if (days > 0) return { label: `Vigente · vence en ${days} ${days === 1 ? "día" : "días"}`, attention: days <= 30 };
  }
  const labels: Record<string, string> = {
    NO_APORTA: "Sin documentación cargada",
    EN_TRAMITE: "En trámite",
    VENCIDO: "Vencido",
    RECHAZADO: "Rechazado",
    VIGENTE: days != null && days < 0 ? "Vencido" : "Pendiente de revisión",
  };
  return { label: labels[member.reprocannStatus] ?? "Pendiente de revisión", attention: true };
}
