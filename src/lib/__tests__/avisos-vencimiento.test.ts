import { describe, expect, it } from "vitest";
import { diasHastaVencer, enVentanaDeAviso, episodioDeVencimiento, textoAvisoVencimiento } from "../avisos-rules";

/**
 * El aviso de vencimiento corre todos los días: si la ventana o el episodio están mal, el socio
 * recibe treinta mails iguales (y el club deja de leer la cola) o ninguno.
 */
const hoy = new Date("2026-11-01T12:00:00.000Z");

describe("aviso de vencimiento del REPROCANN", () => {
  it("cuenta los días por fecha, no por horas", () => {
    expect(diasHastaVencer(new Date("2026-11-30T00:00:00.000Z"), hoy)).toBe(29);
    expect(diasHastaVencer(new Date("2026-11-01T23:00:00.000Z"), hoy)).toBe(0);
    expect(diasHastaVencer(new Date("2026-10-28T00:00:00.000Z"), hoy)).toBe(-4);
    expect(diasHastaVencer(null, hoy)).toBe(null);
  });

  it("la ventana incluye el día del vencimiento y el borde del umbral", () => {
    expect(enVentanaDeAviso(30, 30)).toBe(true);
    expect(enVentanaDeAviso(0, 30)).toBe(true);
    expect(enVentanaDeAviso(31, 30)).toBe(false);
    expect(enVentanaDeAviso(-1, 30)).toBe(false);
    expect(enVentanaDeAviso(null, 30)).toBe(false);
  });

  it("el episodio es la fecha de vencimiento: dos corridas del mismo día son el mismo aviso", () => {
    const a = episodioDeVencimiento(new Date("2026-11-30T00:00:00.000Z"));
    const b = episodioDeVencimiento(new Date("2026-11-30T21:00:00.000Z"));
    expect(a).toBe("vence:2026-11-30");
    expect(a).toBe(b);
    expect(episodioDeVencimiento(new Date("2027-03-15T00:00:00.000Z"))).not.toBe(a);
  });

  it("el texto dice qué pasa y qué hacer, sin afirmar que ya venció", () => {
    const t = textoAvisoVencimiento({ nombre: "Ana", dias: 12, club: "República" });
    expect(t).toContain("Ana");
    expect(t).toContain("vence en 12 días");
    expect(t).toContain("República");
    expect(t).not.toContain("venció");
    expect(textoAvisoVencimiento({ nombre: "Ana", dias: 0, club: "República" })).toContain("vence hoy");
    expect(textoAvisoVencimiento({ nombre: "Ana", dias: 1, club: "República" })).toContain("vence mañana");
  });
});
