import { describe, expect, it } from "vitest";
import { DATOS_LEGALES, faltantesLegales, recordatorioLegal, valorDeDemo } from "../datos-legales";

const completo = {
  nombre: "Asociación Civil República ONG",
  cuit: "30-71234567-8",
  personeria: "Res. IGJ 1234 del 12/03/2024",
  reps: "REPS CABA 456",
  domicilioLegal: "Defensa 1200, CABA",
  reprocannNumber: "REP-0001",
  directorMedico: "Dra. Ana Pérez",
  directorMedicoMatricula: "MN 12345",
  responsableTecnico: "Lic. Juan Gómez",
  responsableTecnicoTitulo: "Farmacéutico",
};

describe("datos legales del club", () => {
  it("con todo cargado no hay faltantes ni recordatorio", () => {
    expect(faltantesLegales(completo)).toEqual([]);
    expect(recordatorioLegal([])).toBe("");
  });

  it("cuenta los que faltan y los nombra", () => {
    const faltan = faltantesLegales({ ...completo, cuit: "  ", reps: null });
    expect(faltan.map((f) => f.campo)).toEqual(["cuit", "reps"]);
    expect(recordatorioLegal(faltan)).toBe("Faltan 2 datos legales del club. Se completan una vez y quedan en los libros.");
  });

  it("los valores de la demo cuentan como faltantes", () => {
    const deDemo = {
      ...completo,
      cuit: "30-00000000-0",
      reprocannNumber: "REPROCANN-DEMO-0001",
      directorMedico: "Dra. Demo (mat. 0000)",
      responsableTecnicoTitulo: "Ing. Agr. Demo",
    };
    expect(faltantesLegales(deDemo).map((f) => f.campo)).toEqual([
      "cuit",
      "reprocannNumber",
      "directorMedico",
      "responsableTecnicoTitulo",
    ]);
  });

  it("reconoce un valor de demo sin confundirlo con uno real", () => {
    expect(valorDeDemo("30-00000000-0")).toBe(true);
    expect(valorDeDemo("Ing. Agr. Demo")).toBe(true);
    expect(valorDeDemo("30-71234567-8")).toBe(false);
    expect(valorDeDemo("Dra. Ana Perez")).toBe(false);
    expect(valorDeDemo("")).toBe(false);
    expect(valorDeDemo(null)).toBe(false);
  });

  it("un solo faltante se pide por su nombre", () => {
    const faltan = faltantesLegales({ ...completo, directorMedicoMatricula: "" });
    expect(recordatorioLegal(faltan)).toBe("Falta un dato legal: Matrícula del director médico.");
  });

  it("cada dato declara para qué se usa", () => {
    expect(DATOS_LEGALES.every((d) => d.para.length > 0)).toBe(true);
    expect(DATOS_LEGALES).toHaveLength(10);
  });
});
