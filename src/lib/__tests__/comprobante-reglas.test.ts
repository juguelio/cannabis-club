import { describe, expect, it } from "vitest";
import { MOTIVO_MINIMO, puedeConfirmarSinComprobante } from "../comprobante-reglas";

describe("confirmar sin comprobante", () => {
  it("un OPERADOR no puede, aunque escriba un motivo largo", () => {
    expect(puedeConfirmarSinComprobante("OPERADOR", "La transferencia ya está acreditada")).toBe(false);
  });

  it("un DISPENSADOR tampoco", () => {
    expect(puedeConfirmarSinComprobante("DISPENSADOR", "La transferencia ya está acreditada")).toBe(false);
  });

  it("un ADMIN con motivo suficiente sí", () => {
    expect(puedeConfirmarSinComprobante("ADMIN", "Acreditada en el homebanking, 12/11")).toBe(true);
  });

  it("sin motivo no hay excepción: el botón no alcanza", () => {
    expect(puedeConfirmarSinComprobante("ADMIN", "")).toBe(false);
    expect(puedeConfirmarSinComprobante("ADMIN", null)).toBe(false);
    expect(puedeConfirmarSinComprobante("ADMIN", "   ")).toBe(false);
  });

  it("un motivo de dos palabras no cuenta: tiene que explicar algo", () => {
    expect(puedeConfirmarSinComprobante("ADMIN", "ok")).toBe(false);
    expect(puedeConfirmarSinComprobante("ADMIN", "x".repeat(MOTIVO_MINIMO - 1))).toBe(false);
    expect(puedeConfirmarSinComprobante("ADMIN", "x".repeat(MOTIVO_MINIMO))).toBe(true);
  });

  it("sin rol no hay excepción", () => {
    expect(puedeConfirmarSinComprobante(null, "Acreditada en el homebanking")).toBe(false);
  });
});
