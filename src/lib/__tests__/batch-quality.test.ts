import { describe, expect, it } from "vitest";
import { canRelease, fichaState, type Checklist } from "../batch-quality";

const ok: Checklist = { moho: true, extrana: true, humedad: true, olor: true };

const base = {
  stage: "CURADO",
  dryWeightG: 340,
  actorId: "user-calidad",
  isAdmin: false,
  harvestActorId: "user-cosecha",
  checklist: ok,
  hasAnalysis: true,
};

describe("liberación del lote", () => {
  it("libera un lote curado con checklist completo y otra firma", () => {
    expect(canRelease(base)).toEqual({ ok: true });
  });

  it("un operador necesita una firma independiente", () => {
    const r = canRelease({ ...base, actorId: "user-cosecha" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("SECOND_SIGNATURE");
  });

  it("el administrador puede liberar su propio ingreso sin controles ni análisis cargados", () => {
    const propio = { ...base, actorId: base.harvestActorId, isAdmin: true, checklist: {}, hasAnalysis: false };
    expect(canRelease(propio)).toEqual({ ok: true });
    expect(canRelease({ ...propio, stage: "RETIRADO" }).ok).toBe(false);
    expect(canRelease({ ...propio, dryWeightG: 0 }).ok).toBe(false);
  });

  it("no libera sin peso seco: no hay stock que liberar", () => {
    const r = canRelease({ ...base, dryWeightG: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("NO_DRY_WEIGHT");
  });

  it("no libera un lote que todavía está en cultivo", () => {
    const r = canRelease({ ...base, stage: "FLORACION" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("STAGE_NOT_RELEASABLE");
  });

  it("exige el checklist de calidad completo", () => {
    const r = canRelease({ ...base, checklist: { ...ok, moho: false } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("CHECKLIST_INCOMPLETE");
      expect(r.message).toContain("moho");
    }
  });

  it("sin análisis hay que decirlo explícitamente", () => {
    const r = canRelease({ ...base, hasAnalysis: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ANALYSIS_REQUIRED");
    expect(canRelease({ ...base, hasAnalysis: false, noAnalysisAcknowledged: true })).toEqual({ ok: true });
  });
});

describe("ficha pública del lote", () => {
  it("sin análisis dice pendiente y no inventa un número", () => {
    const f = fichaState({ stage: "CURADO", thcPct: null, cbdPct: null, labResult: null, recalledAt: null });
    expect(f.thcLabel).toBe("Pendiente de análisis");
    expect(f.analysisLabel).toBe("Sin análisis");
  });

  it("un lote retirado no está disponible aunque la etapa diga otra cosa", () => {
    const f = fichaState({ stage: "DISPONIBLE", thcPct: 21, cbdPct: 0.1, labResult: "Aprobado", recalledAt: new Date() });
    expect(f.recalled).toBe(true);
    expect(f.available).toBe(false);
  });

  it("un lote disponible sin recall está habilitado", () => {
    const f = fichaState({ stage: "DISPONIBLE", thcPct: 21, cbdPct: 0.1, labResult: "Aprobado", recalledAt: null });
    expect(f.available).toBe(true);
    expect(f.thcLabel).toBe("21 %");
  });
});
