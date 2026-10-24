import { describe, expect, it } from "vitest";
import { parseDate, parsePadron, splitCsvLine } from "../padron-import";

const today = new Date("2026-10-24T12:00:00Z");

describe("importación del padrón", () => {
  it("lee fechas argentinas e ISO y rechaza las imposibles", () => {
    expect(parseDate("31/12/1990")).toBe("1990-12-31");
    expect(parseDate("5-3-88")).toBe("1988-03-05");
    expect(parseDate("2001-02-03")).toBe("2001-02-03");
    expect(parseDate("31/02/1990")).toBeNull();
    expect(parseDate("ayer")).toBeNull();
  });
  it("respeta comillas y separador", () => {
    expect(splitCsvLine('"Pérez; Juan";30111222;"dice ""hola"""', ";")).toEqual(["Pérez; Juan", "30111222", 'dice "hola"']);
  });
  it("reconoce encabezados en castellano con tildes y mayúsculas", () => {
    const csv = "﻿Apellido;Nombre;DNI;Fecha de nacimiento;Teléfono;REPROCANN;Vencimiento;Consumo\n" +
      "Gómez;María;30.111.222;12/04/1988;2944000001;REP-1;01/03/2027;Terapéutico\n" +
      "Paz;Luis;28999000;1/1/1980;;;;\n";
    const r = parsePadron(csv, today);
    expect(r.issues).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ lastName: "Gómez", docNumber: "30111222", birthDate: "1988-04-12", reprocannStatus: "VIGENTE", consumptionType: "TERAPEUTICO" });
    expect(r.rows[1]).toMatchObject({ reprocannStatus: "NO_APORTA", consumptionType: "LUDICO" });
  });
  it("acepta 'Apellido y nombre' en una sola columna y separador coma", () => {
    const r = parsePadron("Apellido y nombre,Documento,Nacimiento,Vence REPROCANN,REPROCANN\n\"Ruiz, Ana\",28777888,22/07/1981,01/08/2026,REP-3\n", today);
    expect(r.rows[0]).toMatchObject({ lastName: "Ruiz", firstName: "Ana", reprocannStatus: "VENCIDO" });
  });
  it("explica cada fila con problemas y no la importa", () => {
    const r = parsePadron("Apellido;Nombre;DNI;Nacimiento;Email\nA;Bo;123;xx;mal\nGómez;María;30111222;12/04/1988;\nOtra;Vez;30111222;01/01/1990;\n", today);
    expect(r.rows).toHaveLength(1);
    expect(r.issues.map((i) => i.line)).toEqual([2, 2, 2, 2, 4]);
    expect(r.issues.find((i) => i.line === 4)?.message).toMatch(/repetido/);
  });
  it("avisa si faltan columnas obligatorias", () => {
    const r = parsePadron("Nombre;Telefono\nAna;123\n", today);
    expect(r.rows).toEqual([]);
    expect(r.issues.length).toBeGreaterThanOrEqual(2);
  });
});
