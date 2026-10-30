import { describe, expect, it } from "vitest";
import { permite, seccionDeRuta, seccionesDe, esStaff } from "../roles";

describe("permisos por rol", () => {
  it("el dispensador ve el mostrador y nada de gestión", () => {
    expect(permite("DISPENSADOR", "dispensario")).toBe(true);
    expect(permite("DISPENSADOR", "socios")).toBe(true);
    expect(permite("DISPENSADOR", "stock")).toBe(true);
    expect(permite("DISPENSADOR", "configuracion")).toBe(false);
    expect(permite("DISPENSADOR", "cierre-mensual")).toBe(false);
    expect(permite("DISPENSADOR", "informe-semestral")).toBe(false);
    expect(permite("DISPENSADOR", "reportes")).toBe(false);
    expect(permite("DISPENSADOR", "traslados")).toBe(false);
  });

  it("el operador agrega libros y stock, pero no la configuración", () => {
    expect(permite("OPERADOR", "traslados")).toBe(true);
    expect(permite("OPERADOR", "reportes")).toBe(true);
    expect(permite("OPERADOR", "configuracion")).toBe(false);
    expect(permite("OPERADOR", "cierre-mensual")).toBe(false);
  });

  it("sólo administración abre configuración, cierre mensual e informe", () => {
    expect(permite("ADMIN", "configuracion")).toBe(true);
    expect(permite("ADMIN", "cierre-mensual")).toBe(true);
    expect(permite("ADMIN", "informe-semestral")).toBe(true);
  });

  it("inspección es exclusiva de administración, como indica la matriz documentada", () => {
    expect(permite("ADMIN", "inspeccion")).toBe(true);
    expect(permite("OPERADOR", "inspeccion")).toBe(false);
    expect(permite("DISPENSADOR", "inspeccion")).toBe(false);
    expect(seccionesDe("OPERADOR")).not.toContain("inspeccion");
  });

  it("un socio no entra a ninguna sección de la consola", () => {
    expect(esStaff("SOCIO")).toBe(false);
    expect(seccionesDe("SOCIO")).toEqual([]);
    expect(permite("SOCIO", "panel")).toBe(false);
  });

  it("sin sesión no hay permisos", () => {
    expect(permite(null, "panel")).toBe(false);
    expect(seccionesDe(undefined)).toEqual([]);
  });

  it("traduce la ruta a su sección", () => {
    expect(seccionDeRuta("/")).toBe("panel");
    expect(seccionDeRuta("/stock/abc-123")).toBe("stock");
    expect(seccionDeRuta("/configuracion?seccion=equipo")).toBe("configuracion");
    expect(seccionDeRuta("/portal")).toBeNull();
    expect(seccionDeRuta("/lote/RC-001")).toBeNull();
  });

  it("el menú del dispensador no incluye gestión", () => {
    const s = seccionesDe("DISPENSADOR");
    expect(s).toContain("dispensario");
    expect(s).not.toContain("configuracion");
    expect(s).not.toContain("cierre");
  });
});
