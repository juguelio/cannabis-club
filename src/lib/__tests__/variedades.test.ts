import { describe, expect, it } from "vitest";
import { armarCatalogo } from "../variedad-rules";

const cepa = (id: string, name: string, extra: Partial<{ genetics: string | null; thcPct: unknown; cbdPct: unknown; active: boolean }> = {}) => ({
  id,
  name,
  genetics: extra.genetics ?? null,
  thcPct: extra.thcPct ?? null,
  cbdPct: extra.cbdPct ?? null,
  active: extra.active ?? true,
});

describe("catálogo de variedades del socio", () => {
  it("deja afuera las variedades dadas de baja", () => {
    const out = armarCatalogo([cepa("1", "Viva"), cepa("2", "Vieja", { active: false })], new Map());
    expect(out.map((v) => v.nombre)).toEqual(["Viva"]);
  });

  it("pone primero las que tienen stock y después ordena por nombre", () => {
    const out = armarCatalogo(
      [cepa("1", "Zeta"), cepa("2", "Alfa"), cepa("3", "Beta")],
      new Map([
        ["3", 120],
        ["2", 0],
      ]),
    );
    expect(out.map((v) => `${v.nombre}:${v.disponible}`)).toEqual(["Beta:true", "Alfa:false", "Zeta:false"]);
  });

  it("sin movimientos de stock la variedad no figura con stock", () => {
    const [v] = armarCatalogo([cepa("1", "Alfa")], new Map());
    expect(v.disponible).toBe(false);
  });

  it("redondea THC y CBD a dos decimales y limpia la genética vacía", () => {
    const [v] = armarCatalogo([cepa("1", "Alfa", { thcPct: "18.456", cbdPct: 0.4, genetics: "   " })], new Map([["1", 10]]));
    expect(v.thc).toBe(18.46);
    expect(v.cbd).toBe(0.4);
    expect(v.genetica).toBeNull();
  });

  it("no expone precios ni cantidades: sólo si hay stock", () => {
    const [v] = armarCatalogo([cepa("1", "Alfa", { thcPct: 20 })], new Map([["1", 999]])) as unknown as Record<string, unknown>[];
    expect(Object.keys(v).sort()).toEqual(["cbd", "disponible", "genetica", "id", "nombre", "thc"]);
  });
});
