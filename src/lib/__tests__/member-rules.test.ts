import { describe, expect, it } from "vitest";
import { evaluateStatusChange } from "../member-rules";

describe("estado del socio", () => {
  it("no activa sin consentimiento firmado", () => {
    expect(evaluateStatusChange({ from: "PENDIENTE", to: "ACTIVO", consentSigned: false })).toMatchObject({ ok: false, code: "CONSENT_REQUIRED" });
    expect(evaluateStatusChange({ from: "PENDIENTE", to: "ACTIVO", consentSigned: true })).toEqual({ ok: true });
  });
  it("suspender y dar de baja piden motivo", () => {
    expect(evaluateStatusChange({ from: "ACTIVO", to: "SUSPENDIDO", consentSigned: true, reason: "" })).toMatchObject({ code: "REASON_REQUIRED" });
    expect(evaluateStatusChange({ from: "ACTIVO", to: "BAJA", consentSigned: true, reason: "ok" })).toMatchObject({ code: "REASON_REQUIRED" });
    expect(evaluateStatusChange({ from: "ACTIVO", to: "BAJA", consentSigned: true, reason: "Renuncia por nota" })).toEqual({ ok: true });
  });
  it("una baja vuelve sólo a pendiente", () => {
    expect(evaluateStatusChange({ from: "BAJA", to: "ACTIVO", consentSigned: true })).toMatchObject({ code: "INVALID_TRANSITION" });
    expect(evaluateStatusChange({ from: "BAJA", to: "PENDIENTE", consentSigned: true })).toEqual({ ok: true });
  });
  it("rechaza el mismo estado", () => {
    expect(evaluateStatusChange({ from: "ACTIVO", to: "ACTIVO", consentSigned: true })).toMatchObject({ code: "SAME_STATUS" });
  });
});
