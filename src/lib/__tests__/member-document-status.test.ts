import { describe, expect, it } from "vitest";
import { memberDocumentStatus } from "../member-document-status";

describe("documentación del portal", () => {
  it.each([
    ["NO_APORTA", "Sin documentación cargada"],
    ["EN_TRAMITE", "En trámite"],
    ["RECHAZADO", "Rechazado"],
    ["VENCIDO", "Vencido"],
  ])("distingue %s de un documento vencido", (reprocannStatus, label) => {
    expect(memberDocumentStatus({ reprocannStatus, reprocannOk: false, reprocannDays: null }).label).toBe(label);
  });
  it("no presenta una vigencia indefinida cuando falta la fecha", () => {
    expect(memberDocumentStatus({ reprocannStatus: "VIGENTE", reprocannOk: true, reprocannDays: null })).toEqual({ label: "Vigente · sin fecha de vencimiento cargada", attention: true });
  });
  it("distingue hoy, mañana y una fecha vencida", () => {
    const member = { reprocannStatus: "VIGENTE", reprocannOk: true };
    expect(memberDocumentStatus({ ...member, reprocannDays: 0 }).label).toBe("Vence hoy");
    expect(memberDocumentStatus({ ...member, reprocannDays: 1 }).label).toBe("Vigente · vence en 1 día");
    expect(memberDocumentStatus({ ...member, reprocannOk: false, reprocannDays: -1 }).label).toBe("Vencido");
    expect(memberDocumentStatus({ ...member, reprocannDays: 31 }).attention).toBe(false);
  });
});
