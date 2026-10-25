import { describe, expect, it } from "vitest";
import { balanceOf, isValidPeriod, nextPeriod, periodOf } from "../account";

describe("cuenta corriente del socio", () => {
  it("el saldo es la suma con signo: los cargos suman y los pagos restan", () => {
    expect(balanceOf([
      { kind: "CARGO", amountArs: 1200 },
      { kind: "CARGO", amountArs: 800 },
      { kind: "PAGO", amountArs: 500 },
    ])).toBe(1500);
  });

  it("un contra-asiento deja el saldo en cero (no se borra nada)", () => {
    const cargo = { kind: "CARGO" as const, amountArs: 3600 };
    const contra = { kind: "PAGO" as const, amountArs: 3600 };
    expect(balanceOf([cargo, contra])).toBe(0);
  });

  it("el pago de más deja saldo a favor (negativo)", () => {
    expect(balanceOf([
      { kind: "CARGO", amountArs: 1000 },
      { kind: "PAGO", amountArs: 2500 },
    ])).toBe(-1500);
  });

  it("sin movimientos el saldo es cero", () => {
    expect(balanceOf([])).toBe(0);
  });

  it("el período se calcula en la zona del club, no en UTC", () => {
    // 1 de noviembre 02:00 UTC = 31 de octubre 23:00 en Argentina.
    expect(periodOf(new Date("2026-11-01T02:00:00.000Z"))).toBe("2026-10");
    expect(periodOf(new Date("2026-11-01T12:00:00.000Z"))).toBe("2026-11");
  });

  it("el período siguiente cruza el año", () => {
    expect(nextPeriod("2026-12")).toBe("2027-01");
    expect(nextPeriod("2026-01")).toBe("2026-02");
  });

  it("valida el formato del período", () => {
    expect(isValidPeriod("2026-10")).toBe(true);
    expect(isValidPeriod("2026-13")).toBe(false);
    expect(isValidPeriod("26-10")).toBe(false);
  });
});
