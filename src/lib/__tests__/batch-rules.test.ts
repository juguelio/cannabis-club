import { describe, expect, it } from "vitest";
import { evaluateStageChange, nextStages } from "../batch-rules";

describe("ciclo de vida del lote", () => {
  it("avanza el cultivo paso a paso", () => {
    expect(evaluateStageChange({ from: "PROPAGACION", to: "VEGETATIVO", balanceG: 0 }).ok).toBe(true);
    expect(evaluateStageChange({ from: "VEGETATIVO", to: "FLORACION", balanceG: 0 }).ok).toBe(true);
  });
  it("no deja saltar etapas ni pasar a disponible sin peso seco", () => {
    const skip = evaluateStageChange({ from: "PROPAGACION", to: "FLORACION", balanceG: 0 });
    expect(skip).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    const dry = evaluateStageChange({ from: "CURADO", to: "DISPONIBLE", balanceG: 0 });
    expect(dry).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    if (!dry.ok) expect(dry.message).toMatch(/peso seco/);
  });
  it("agotar exige saldo cero y reabrir exige saldo", () => {
    expect(evaluateStageChange({ from: "DISPONIBLE", to: "AGOTADO", balanceG: 3 })).toMatchObject({ ok: false, code: "HAS_STOCK" });
    expect(evaluateStageChange({ from: "DISPONIBLE", to: "AGOTADO", balanceG: 0 }).ok).toBe(true);
    expect(evaluateStageChange({ from: "AGOTADO", to: "DISPONIBLE", balanceG: 0 })).toMatchObject({ ok: false, code: "NO_STOCK" });
    expect(evaluateStageChange({ from: "AGOTADO", to: "DISPONIBLE", balanceG: 4 }).ok).toBe(true);
  });
  it("destruir pide motivo y destruye el saldo restante", () => {
    expect(evaluateStageChange({ from: "DISPONIBLE", to: "DESTRUIDO", balanceG: 12.5, reason: "" })).toMatchObject({ ok: false, code: "REASON_REQUIRED" });
    expect(evaluateStageChange({ from: "DISPONIBLE", to: "DESTRUIDO", balanceG: 12.5, reason: "Moho en curado" })).toEqual({ ok: true, destroyRemainderG: 12.5 });
  });
  it("un lote destruido no tiene salida", () => {
    expect(nextStages("DESTRUIDO")).toEqual([]);
    expect(evaluateStageChange({ from: "DESTRUIDO", to: "DISPONIBLE", balanceG: 10 }).ok).toBe(false);
  });
});
