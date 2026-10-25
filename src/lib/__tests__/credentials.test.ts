import { describe, expect, it } from "vitest";
import { passwordPolicy, tempPasswordExpired, TEMP_PASSWORD_HOURS } from "../credentials";

const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000);

describe("clave temporal del mostrador", () => {
  it("vale dentro de la ventana", () => {
    expect(tempPasswordExpired(hoursAgo(TEMP_PASSWORD_HOURS - 1))).toBe(false);
  });

  it("vence pasada la ventana", () => {
    expect(tempPasswordExpired(hoursAgo(TEMP_PASSWORD_HOURS + 1))).toBe(true);
  });

  it("una cuenta sin marca de cambio no vence sola", () => {
    expect(tempPasswordExpired(null)).toBe(false);
  });
});

describe("política de la clave nueva", () => {
  it("exige largo mínimo", () => {
    const r = passwordPolicy("corta1");
    expect(r.ok).toBe(false);
  });

  it("no acepta sólo números", () => {
    const r = passwordPolicy("12345678");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("números");
  });

  it("no acepta la misma clave temporal", () => {
    const r = passwordPolicy("abcde-23456", "abcde-23456");
    expect(r.ok).toBe(false);
  });

  it("no acepta espacios en los extremos", () => {
    expect(passwordPolicy(" clave-larga ").ok).toBe(false);
  });

  it("acepta una clave razonable", () => {
    expect(passwordPolicy("republica-2026").ok).toBe(true);
  });
});
