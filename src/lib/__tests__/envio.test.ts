import { describe, expect, it } from "vitest";
import { evaluateEnvio } from "../pickup-rules";

/**
 * El envío tiene tres condiciones propias y cada una tiene que explicarse sola:
 * zona del club, dirección real y tope por caja. Un pedido que pasa estas tres todavía
 * tiene que pasar los controles de siempre (socio activo, REPROCANN, topes, stock).
 */
const zonas = [
  { zona: "CABA", precioArs: 20000, demora: "Menos de 48 h", transportista: "Andreani" },
  { zona: "Patagonia", precioArs: 25000, demora: "5 dias habiles", transportista: "Andreani" },
];

const base = {
  grams: 10,
  direccion: "Los Andes 480, San Martín de los Andes, 8370",
  zona: "Patagonia",
  zonas,
  topeEnvioG: 40,
};

describe("envío a domicilio", () => {
  it("acepta un pedido dentro de la zona y del tope, y devuelve el costo del club", () => {
    const r = evaluateEnvio(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.costoArs).toBe(25000);
      expect(r.demora).toBe("5 dias habiles");
      expect(r.transportista).toBe("Andreani");
    }
  });

  it("sin zonas cargadas manda a retirar en el club", () => {
    const r = evaluateEnvio({ ...base, zonas: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ENVIO_SIN_ZONAS");
  });

  it("una zona que el club no cobra se rechaza", () => {
    const r = evaluateEnvio({ ...base, zona: "Marte" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ENVIO_SIN_ZONA");
  });

  it("una dirección de juguete no viaja", () => {
    const r = evaluateEnvio({ ...base, direccion: "  casa " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ENVIO_SIN_DIRECCION");
  });

  it("más gramos que la caja: se pide dividir, no se parte solo", () => {
    const r = evaluateEnvio({ ...base, grams: 50 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ENVIO_TOPE");
      expect(r.message).toContain("40 g");
    }
  });

  it("el tope es inclusivo: 40 g entra", () => {
    const r = evaluateEnvio({ ...base, grams: 40 });
    expect(r.ok).toBe(true);
  });
});
