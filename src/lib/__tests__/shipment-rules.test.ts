import { describe, expect, it } from "vitest";
import { canDispatch, shipmentCode, totalGrams } from "../shipment-rules";

describe("código del traslado", () => {
  it("arma TR-AAAAMMDD-NN con secuencia del día", () => {
    expect(shipmentCode(new Date("2026-10-25T13:00:00Z"), 0)).toBe("TR-20261025-01");
    expect(shipmentCode(new Date("2026-10-25T23:59:00Z"), 4)).toBe("TR-20261025-05");
    expect(shipmentCode(new Date("2026-01-02T02:00:00Z"), 11)).toBe("TR-20260102-12");
  });
});

describe("¿puede salir el traslado?", () => {
  it("sin pacientes no sale", () => {
    expect(canDispatch([]).ok).toBe(false);
  });

  it("con un paciente sin DDJJ no sale, y dice cuántos faltan", () => {
    const r = canDispatch([{ grams: 10, ddjjSignedAt: new Date() }, { grams: 5, ddjjSignedAt: null }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("un paciente");
  });

  it("cuenta las DDJJ faltantes cuando hay varias", () => {
    const r = canDispatch([{ grams: 10, ddjjSignedAt: null }, { grams: 5, ddjjSignedAt: null }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("2 DDJJ");
  });

  it("un ítem sin gramos bloquea", () => {
    const r = canDispatch([{ grams: 0, ddjjSignedAt: new Date() }]);
    expect(r.ok).toBe(false);
  });

  it("con todo firmado y con gramos, sale", () => {
    expect(canDispatch([{ grams: 10, ddjjSignedAt: new Date() }, { grams: 5, ddjjSignedAt: "2026-10-25" }]).ok).toBe(true);
  });
});

describe("total del traslado", () => {
  it("suma en centavos sin arrastrar decimales", () => {
    expect(totalGrams([{ grams: 0.1 }, { grams: 0.2 }])).toBe(0.3);
    expect(totalGrams([{ grams: "5.25" }, { grams: 2 }])).toBe(7.25);
    expect(totalGrams([])).toBe(0);
  });
});
