import { describe, expect, it } from "vitest";
import { cotizacionDeLista, cotizacionLegible } from "../cotizacion";
import { aporteMembresiaEnPesos, aportePorGramoDe, preciosDeClub, validarPrecios } from "../precios";

const DOLARES = [
  { casa: "oficial", nombre: "Oficial", compra: 1510, venta: 1560, fechaActualizacion: "2026-10-30T18:55:00.000Z" },
  { casa: "blue", nombre: "Blue", compra: 1545, venta: 1565, fechaActualizacion: "2026-10-31T20:57:00.000Z" },
  { casa: "bolsa", nombre: "Bolsa", compra: 1565.4, venta: 1575, fechaActualizacion: "2026-10-31T20:57:00.000Z" },
];

describe("cotización del dólar", () => {
  it("toma el valor de venta de la fuente pedida", () => {
    const c = cotizacionDeLista(DOLARES, "blue");
    expect(c.valor).toBe(1565);
    expect(c.actualizadaAt).toBe("2026-10-31T20:57:00.000Z");
  });

  it("si la fuente no vino, devuelve cero en vez de inventar", () => {
    expect(cotizacionDeLista(DOLARES, "oficial").valor).toBe(1560);
    expect(cotizacionDeLista([], "blue").valor).toBe(0);
    expect(cotizacionDeLista(null, "blue").valor).toBe(0);
  });

  it("la etiqueta dice fuente, valor y cuándo", () => {
    expect(cotizacionLegible({ fuente: "blue", valor: 1565, actualizadaAt: "2026-10-31T20:57:00.000Z" })).toMatch(/Blue.*1\.565/);
    expect(cotizacionLegible({ fuente: "blue", valor: 0, actualizadaAt: null })).toBe("Sin cotización cargada");
  });
});

describe("aporte fijado en dólares", () => {
  const enUsd = {
    moneda: "USD",
    membresiaGramos: 10,
    aporteMembresiaUsd: 85,
    cotizacion: { fuente: "blue", valor: 1565, actualizadaAt: "2026-10-31T20:57:00.000Z" },
    maxMembresiasPorEnvio: 4,
    envios: [],
    productos: [],
  };

  it("convierte el aporte a pesos con la cotización del día", () => {
    const p = preciosDeClub({ precios: enUsd });
    expect(aporteMembresiaEnPesos(p)).toBe(133_025); // 85 × 1.565
    expect(aportePorGramoDe(p)).toBe(13_302.5);
  });

  it("sin cotización no hay cargo (y avisa al guardar)", () => {
    const p = preciosDeClub({ precios: { ...enUsd, cotizacion: { fuente: "blue", valor: 0, actualizadaAt: null } } });
    expect(aportePorGramoDe(p)).toBeNull();
    const r = validarPrecios({ ...enUsd, cotizacion: { fuente: "blue", valor: 0, actualizadaAt: null } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/cotización del día/);
  });

  it("en pesos sigue funcionando igual que antes", () => {
    const p = preciosDeClub({ precios: { moneda: "ARS", membresiaGramos: 10, aporteMembresiaArs: 130_000 } });
    expect(aportePorGramoDe(p)).toBe(13_000);
  });
});
