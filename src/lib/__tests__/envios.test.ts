import { describe, expect, it } from "vitest";
import { faltaParaMinimo, zonaPorCp } from "../envios";
import type { Envio } from "../precios";

const ZONAS: Envio[] = [
  { zona: "CABA", precioArs: 20000, demora: "Menos de 48 h" },
  { zona: "Gran Buenos Aires - 1er cordon", precioArs: 25000, demora: "Menos de 48 h" },
  { zona: "Gran Buenos Aires - 2do cordon", precioArs: 25000, demora: "Menos de 48 h" },
  { zona: "Interior y resto de la provincia de Buenos Aires", precioArs: 25000, demora: "5 dias habiles", transportista: "Andreani" },
];

describe("zonaPorCp", () => {
  it("un CP de CABA cae en la zona de CABA", () => {
    const r = zonaPorCp("1428", ZONAS);
    expect(r.estado).toBe("CUBIERTA");
    if (r.estado === "CUBIERTA") {
      expect(r.zona.zona).toBe("CABA");
      expect(r.aproximada).toBe(false);
    }
  });

  it("un CP de San Martín de los Andes cae en el interior con Andreani", () => {
    const r = zonaPorCp("8370", ZONAS);
    if (r.estado !== "CUBIERTA") throw new Error("debería estar cubierta");
    expect(r.zona.zona).toContain("Interior");
    expect(r.zona.transportista).toBe("Andreani");
  });

  it("el conurbano avisa que el cordón es aproximado: el club cobra distinto el 1.º y el 2.º", () => {
    const r = zonaPorCp("1650", ZONAS);
    if (r.estado !== "CUBIERTA") throw new Error("debería estar cubierta");
    expect(r.aproximada).toBe(true);
    expect(r.motivo).toContain("cordón");
  });

  it("sin código postal no adivina la zona", () => {
    expect(zonaPorCp(null, ZONAS).estado).toBe("SIN_CP");
    expect(zonaPorCp("", ZONAS).estado).toBe("SIN_CP");
  });

  it("si el club no configuró zonas, lo dice en vez de inventar una", () => {
    expect(zonaPorCp("8370", []).estado).toBe("SIN_ZONAS");
  });

  it("si no hay zona que cubra ese rango, lo dice con el motivo", () => {
    const soloCaba: Envio[] = [{ zona: "CABA", precioArs: 20000, demora: "48 h" }];
    const r = zonaPorCp("8370", soloCaba);
    expect(r.estado).toBe("SIN_COBERTURA");
  });
});

describe("faltaParaMinimo", () => {
  it("con 3 g y mínimo de 5 g, faltan 2", () => {
    expect(faltaParaMinimo(3, 5)).toBe(2);
  });

  it("llegando al mínimo no falta nada", () => {
    expect(faltaParaMinimo(5, 5)).toBe(0);
    expect(faltaParaMinimo(10, 5)).toBe(0);
  });

  it("sin mínimo configurado no se exige nada", () => {
    expect(faltaParaMinimo(1, 0)).toBe(0);
  });
});
