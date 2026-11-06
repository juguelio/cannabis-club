import { describe, expect, it } from "vitest";
import { esEmailDePrueba, primerosPasos, progresoArranque } from "../primeros-pasos";

const vacio = { legalesFaltantes: 10, variedades: 0, equipoReal: 0, lotes: 0, socios: 0 };

describe("primeros pasos del club", () => {
  it("un club recién creado tiene todo pendiente", () => {
    const pasos = primerosPasos(vacio);
    expect(pasos).toHaveLength(5);
    expect(progresoArranque(pasos)).toEqual({ hechos: 0, total: 5, completo: false });
  });

  it("marca cada paso con el estado real", () => {
    const pasos = primerosPasos({ legalesFaltantes: 0, variedades: 3, equipoReal: 2, lotes: 1, socios: 4 });
    expect(progresoArranque(pasos).completo).toBe(true);
  });

  it("dice cuántos datos legales faltan", () => {
    const legales = primerosPasos({ ...vacio, legalesFaltantes: 3 }).find((p) => p.key === "legales")!;
    expect(legales.hint).toBe("3 sin cargar");
    expect(legales.hecho).toBe(false);
  });

  it("avisa cuando el equipo sigue con cuentas de prueba", () => {
    const equipo = primerosPasos(vacio).find((p) => p.key === "equipo")!;
    expect(equipo.hint).toBe("Hoy hay cuentas de prueba");
  });

  it("reconoce los dominios de prueba y no los institucionales", () => {
    expect(esEmailDePrueba("admin@club.test")).toBe(true);
    expect(esEmailDePrueba("alguien@example.com")).toBe(true);
    expect(esEmailDePrueba("presidencia@clubong.org.ar")).toBe(false);
    expect(esEmailDePrueba("sin-arroba")).toBe(false);
  });
});
