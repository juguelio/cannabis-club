import { describe, expect, it } from "vitest";
import { evaluatePickup, type PickupRulesInput } from "../pickup-rules";

const base: PickupRulesInput = {
  grams: 10,
  memberActive: true,
  reprocannOk: true,
  monthLimitG: 50,
  monthUsedG: 10,
  pendingGrams: 0,
  dayLimitG: 25,
  dayUsedG: 0,
  stockG: 500,
};

describe("reserva de retiro", () => {
  it("acepta una reserva dentro del saldo del mes", () => {
    const r = evaluatePickup(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.remainingAfterG).toBe(30);
  });

  it("descuenta lo ya reservado y no retirado", () => {
    // 50 de tope - 10 retirados - 30 reservados = 10 disponibles: justo entra
    const justo = evaluatePickup({ ...base, grams: 10, pendingGrams: 30 });
    expect(justo.ok).toBe(true);
    if (justo.ok) expect(justo.remainingAfterG).toBe(0);

    // un gramo más ya no entra
    expect(evaluatePickup({ ...base, grams: 11, pendingGrams: 30 })).toMatchObject({ ok: false, code: "MONTHLY_LIMIT" });
  });

  it("respeta el tope mensual", () => {
    const r = evaluatePickup({ ...base, grams: 41 });
    expect(r).toMatchObject({ ok: false, code: "MONTHLY_LIMIT" });
    if (!r.ok) expect(r.message).toContain("40");
  });

  it("respeta el tope diario", () => {
    const r = evaluatePickup({ ...base, dayUsedG: 20, grams: 10 });
    expect(r).toMatchObject({ ok: false, code: "DAILY_LIMIT" });
  });

  it("bloquea sin REPROCANN vigente", () => {
    expect(evaluatePickup({ ...base, reprocannOk: false })).toMatchObject({ ok: false, code: "REPROCANN" });
  });

  it("bloquea ficha inactiva y montos inválidos", () => {
    expect(evaluatePickup({ ...base, memberActive: false })).toMatchObject({ ok: false, code: "MEMBER_INACTIVE" });
    expect(evaluatePickup({ ...base, grams: 0 })).toMatchObject({ ok: false, code: "INVALID_AMOUNT" });
    expect(evaluatePickup({ ...base, grams: -3 })).toMatchObject({ ok: false, code: "INVALID_AMOUNT" });
  });

  it("no reserva más de lo que hay en stock", () => {
    const r = evaluatePickup({ ...base, stockG: 4 });
    expect(r).toMatchObject({ ok: false, code: "NO_STOCK" });
  });
});
