import { describe, expect, it } from "vitest";
import { ageYears, balanceFromMovements, evaluateDispensation, type LimitConfig } from "../limits";

const config: LimitConfig = {
  limiteDiarioG: 25,
  limiteMensualG: 50,
  limiteMenorG: 30,
  edadMinima: 18,
  edadLimiteMenor: 21,
  thcMaxMenor: 10,
  requiereReprocann: true,
};

const adult = {
  status: "ACTIVO",
  birthDate: new Date("1988-04-12T00:00:00.000Z"),
  reprocannStatus: "VIGENTE",
  reprocannExpiresAt: new Date("2027-03-01T00:00:00.000Z"),
  monthlyForecastG: 30,
};

const at = new Date("2026-10-24T15:00:00.000Z");
const usage = (dayGrams = 0, monthGrams = 0) => ({ dayGrams, monthGrams });

describe("ageYears", () => {
  it("no cuenta el año si todavía no llegó el cumpleaños", () => {
    expect(ageYears("2000-12-31T00:00:00.000Z", at)).toBe(25);
    expect(ageYears("2000-01-01T00:00:00.000Z", at)).toBe(26);
    expect(ageYears("2008-10-24T00:00:00.000Z", at)).toBe(18);
    expect(ageYears("2008-10-25T00:00:00.000Z", at)).toBe(17);
  });
});

describe("evaluateDispensation", () => {
  // R03 del REA de operación: ausencia de dato no es aprobación.
  it("bloquea a un menor si el lote no declara THC", () => {
    const minor = { ...adult, birthDate: new Date("2007-05-05T00:00:00.000Z") };
    const d = evaluateDispensation({ member: minor, usage: usage(), config, grams: 5, thcPct: null, at });
    expect(d).toMatchObject({ ok: false, code: "THC_UNKNOWN" });
  });

  it("al adulto no le exige THC del lote", () => {
    const d = evaluateDispensation({ member: adult, usage: usage(), config, grams: 5, thcPct: null, at });
    expect(d.ok).toBe(true);
  });

  it("REPROCANN vigente sin fecha de vencimiento queda incompleto, no habilitado", () => {
    const sinFecha = { ...adult, reprocannExpiresAt: null };
    const d = evaluateDispensation({ member: sinFecha, usage: usage(), config, grams: 5, thcPct: 15, at });
    expect(d).toMatchObject({ ok: false, code: "REPROCANN_INCOMPLETE" });
  });

  it("rechaza uso negativo: una anulación de otro día no regala cupo", () => {
    const d = evaluateDispensation({ member: adult, usage: usage(-5, 45), config, grams: 30, thcPct: 15, at });
    expect(d).toMatchObject({ ok: false, code: "MONTHLY_LIMIT" });
  });

  it("habilita una entrega normal y deja snapshot", () => {
    const d = evaluateDispensation({ member: adult, usage: usage(5, 10), config, grams: 5, thcPct: 18.5, at });
    expect(d.ok).toBe(true);
    expect(d.code).toBe("OK");
    expect(d.snapshot.usageAfter).toEqual({ dayGrams: 10, monthGrams: 15 });
    expect(d.snapshot.limitsApplied.monthlyG).toBe(50);
    expect(d.snapshot.ageYears).toBe(38);
  });

  it("rechaza socio no activo", () => {
    const d = evaluateDispensation({ member: { ...adult, status: "SUSPENDIDO" }, usage: usage(), config, grams: 5, at });
    expect(d.code).toBe("MEMBER_NOT_ACTIVE");
  });

  it("rechaza menor de edad mínima", () => {
    const d = evaluateDispensation({
      member: { ...adult, birthDate: new Date("2009-01-01T00:00:00.000Z") },
      usage: usage(), config, grams: 5, at,
    });
    expect(d.code).toBe("UNDERAGE");
  });

  it("rechaza REPROCANN no vigente y vencido", () => {
    expect(
      evaluateDispensation({ member: { ...adult, reprocannStatus: "EN_TRAMITE" }, usage: usage(), config, grams: 5, at }).code,
    ).toBe("REPROCANN_MISSING");
    expect(
      evaluateDispensation({
        member: { ...adult, reprocannExpiresAt: new Date("2026-08-01T00:00:00.000Z") },
        usage: usage(), config, grams: 5, at,
      }).code,
    ).toBe("REPROCANN_EXPIRED");
  });

  it("permite operar sin REPROCANN solo si la config lo habilita", () => {
    const d = evaluateDispensation({
      member: { ...adult, reprocannStatus: "NO_APORTA" },
      usage: usage(),
      config: { ...config, requiereReprocann: false },
      grams: 5,
      at,
    });
    expect(d.ok).toBe(true);
  });

  it("aplica tope diario y mensual", () => {
    expect(evaluateDispensation({ member: adult, usage: usage(24, 24), config, grams: 2, at }).code).toBe("DAILY_LIMIT");
    expect(evaluateDispensation({ member: adult, usage: usage(0, 48), config, grams: 3, at }).code).toBe("MONTHLY_LIMIT");
    // justo en el límite se permite
    expect(evaluateDispensation({ member: adult, usage: usage(20, 45), config, grams: 5, at }).ok).toBe(true);
  });

  it("para 18-20 aplica tope mensual reducido, tope de THC y edad mínima de 18", () => {
    const joven = { ...adult, birthDate: new Date("2007-02-18T00:00:00.000Z") }; // 19 años
    expect(evaluateDispensation({ member: joven, usage: usage(0, 20), config, grams: 5, thcPct: 12, at }).code).toBe("THC_LIMIT");
    expect(evaluateDispensation({ member: joven, usage: usage(0, 28), config, grams: 5, thcPct: 9, at }).code).toBe("MONTHLY_LIMIT");
    expect(evaluateDispensation({ member: joven, usage: usage(0, 20), config, grams: 5, thcPct: 9, at }).ok).toBe(true);
  });

  it("rechaza cantidades inválidas", () => {
    expect(evaluateDispensation({ member: adult, usage: usage(), config, grams: 0, at }).code).toBe("INVALID_AMOUNT");
    expect(evaluateDispensation({ member: adult, usage: usage(), config, grams: -3, at }).code).toBe("INVALID_AMOUNT");
  });
});

describe("balanceFromMovements", () => {
  it("suma con signo por tipo de movimiento", () => {
    expect(
      balanceFromMovements([
        { type: "INGRESO", grams: "520.00" },
        { type: "DISPENSACION", grams: 5 },
        { type: "DESTRUCCION", grams: 15 },
        { type: "DISPENSACION_REVERSA", grams: 5 },
      ]),
    ).toBe(505);
  });
  it("puede dar negativo (lo detecta la transacción, no la función)", () => {
    expect(balanceFromMovements([{ type: "DISPENSACION", grams: 3 }])).toBe(-3);
  });
});
