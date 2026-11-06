import { describe, expect, it } from "vitest";
import { aportePorGramoDe, gramosPorEnvio, preciosDeClub, PRECIOS_POR_DEFECTO, validarPrecios } from "../precios";

const ejemplo = {
  membresiaGramos: 10,
  aporteMembresiaArs: 130_000,
  maxMembresiasPorEnvio: 4,
  envios: [
    { zona: "CABA", precioArs: 10_000, demora: "menos de 48 h" },
    { zona: "Interior", precioArs: 25_000, demora: "3 días hábiles", transportista: "Andreani" },
  ],
  productos: [{ nombre: "Live Rosin 90u", precioArs: 110_000, detalle: "1 g", activo: true }],
};

describe("precios del club", () => {
  it("un club sin configurar arranca con 10 g y 4 por envío", () => {
    const p = preciosDeClub({});
    expect(p.membresiaGramos).toBe(PRECIOS_POR_DEFECTO.membresiaGramos);
    expect(p.maxMembresiasPorEnvio).toBe(4);
    expect(aportePorGramoDe(p)).toBeNull();
  });

  it("el aporte por gramo sale de dividir el aporte por membresía", () => {
    expect(aportePorGramoDe(preciosDeClub({ precios: ejemplo }))).toBe(13_000);
  });

  it("los gramos por envío son membresía por máximo", () => {
    expect(gramosPorEnvio(preciosDeClub({ precios: ejemplo }))).toBe(40);
  });

  it("un club viejo sólo con aporte por gramo sigue calculando", () => {
    expect(preciosDeClub({ aportePorGramo: 13_000 }).aporteMembresiaArs).toBe(130_000);
  });

  it("valida lo que manda la pantalla y devuelve el aporte por gramo", () => {
    const r = validarPrecios(ejemplo);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.aportePorGramo).toBe(13_000);
  });

  it("rechaza una membresía de 0 gramos", () => {
    const r = validarPrecios({ ...ejemplo, membresiaGramos: 0 });
    expect(r.ok).toBe(false);
  });

  it("rechaza más de 10 membresías por envío", () => {
    const r = validarPrecios({ ...ejemplo, maxMembresiasPorEnvio: 12 });
    expect(r.ok).toBe(false);
  });

  it("acepta precios con coma decimal", () => {
    const p = preciosDeClub({ precios: { ...ejemplo, aporteMembresiaArs: "130000,50" } });
    expect(p.aporteMembresiaArs).toBe(130000.5);
  });
});
