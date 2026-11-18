import { describe, expect, it } from "vitest";
import {
  agruparPorDestino,
  destinoDeFila,
  esPeriodo,
  rangoPeriodo,
  totalesDestino,
  type FilaEnvio,
} from "../envios-destino";

const fila = (parcial: Partial<FilaEnvio>): FilaEnvio => ({
  localidad: null,
  zona: null,
  grams: 0,
  costoEnvio: 0,
  aporte: 0,
  ...parcial,
});

describe("destinoDeFila", () => {
  it("usa la localidad del socio", () => {
    expect(destinoDeFila({ localidad: "San Martín de los Andes", zona: "Interior" })).toBe(
      "San Martín de los Andes",
    );
  });

  it("cae a la zona cuando falta la localidad", () => {
    expect(destinoDeFila({ localidad: null, zona: "Interior y resto de la provincia de Buenos Aires" })).toBe(
      "Zona: Interior y resto de la provincia de Buenos Aires",
    );
  });

  it("marca «Sin localidad» cuando no hay ni localidad ni zona", () => {
    expect(destinoDeFila({ localidad: "  ", zona: null })).toBe("Sin localidad");
  });
});

describe("agruparPorDestino", () => {
  it("suma envíos, gramos, costo y aporte por localidad", () => {
    const filas = [
      fila({ localidad: "San Martín de los Andes", grams: 40, costoEnvio: 25000, aporte: 332000 }),
      fila({ localidad: "San Martín de los Andes", grams: 40, costoEnvio: 25000, aporte: 332000 }),
      fila({ localidad: "Los Toldos", grams: 5, costoEnvio: 25000, aporte: 42000 }),
    ];
    const [primero, segundo] = agruparPorDestino(filas);
    expect(primero).toEqual({
      destino: "San Martín de los Andes",
      envios: 2,
      gramos: 80,
      costoEnvio: 50000,
      aporte: 664000,
      total: 714000,
    });
    expect(segundo.destino).toBe("Los Toldos");
    expect(segundo.envios).toBe(1);
  });

  it("ordena por cantidad de envíos y, a igual cantidad, por lo que se gastó en envío", () => {
    const filas = [
      fila({ localidad: "Bahía Blanca", costoEnvio: 20000 }),
      fila({ localidad: "Los Toldos", costoEnvio: 30000 }),
      fila({ localidad: "Los Toldos", costoEnvio: 30000 }),
    ];
    expect(agruparPorDestino(filas).map((d) => d.destino)).toEqual(["Los Toldos", "Bahía Blanca"]);
  });

  it("desempata alfabéticamente para que el orden sea estable", () => {
    const filas = [fila({ localidad: "Zapala", costoEnvio: 100 }), fila({ localidad: "Aluminé", costoEnvio: 100 })];
    expect(agruparPorDestino(filas).map((d) => d.destino)).toEqual(["Aluminé", "Zapala"]);
  });

  it("no rompe con lista vacía", () => {
    expect(agruparPorDestino([])).toEqual([]);
    expect(totalesDestino([])).toEqual({ destinos: 0, envios: 0, gramos: 0, costoEnvio: 0, aporte: 0, total: 0 });
  });

  it("redondea a dos decimales los gramos fraccionarios", () => {
    const [d] = agruparPorDestino([
      fila({ localidad: "San Martín de los Andes", grams: 2.5 }),
      fila({ localidad: "San Martín de los Andes", grams: 2.5 }),
      fila({ localidad: "San Martín de los Andes", grams: 0.1 }),
    ]);
    expect(d.gramos).toBe(5.1);
  });
});

describe("totalesDestino", () => {
  it("suma todas las filas del período", () => {
    const destinos = agruparPorDestino([
      fila({ localidad: "San Martín de los Andes", grams: 40, costoEnvio: 25000, aporte: 100000 }),
      fila({ localidad: "Los Toldos", grams: 10, costoEnvio: 25000, aporte: 50000 }),
    ]);
    expect(totalesDestino(destinos)).toEqual({
      destinos: 2,
      envios: 2,
      gramos: 50,
      costoEnvio: 50000,
      aporte: 150000,
      total: 200000,
    });
  });
});

describe("rangoPeriodo", () => {
  const ahora = new Date(2026, 10, 17, 21, 30); // 17/11/2026 21:30, hora local

  it("el mes en curso empieza el día 1 y cierra hoy a las 23:59", () => {
    const r = rangoPeriodo("mes", ahora);
    expect(r.desde.getFullYear()).toBe(2026);
    expect(r.desde.getMonth()).toBe(10);
    expect(r.desde.getDate()).toBe(1);
    expect(r.hasta.getDate()).toBe(17);
    expect(r.hasta.getHours()).toBe(23);
    expect(r.etiqueta).toBe("Noviembre de 2026");
  });

  it("el trimestre arranca dos meses atrás", () => {
    const r = rangoPeriodo("trimestre", ahora);
    expect(r.desde.getMonth()).toBe(8); // septiembre
    expect(r.desde.getDate()).toBe(1);
    expect(r.etiqueta).toBe("Últimos 3 meses");
  });

  it("el año arranca el 1 de enero", () => {
    const r = rangoPeriodo("anio", ahora);
    expect(r.desde.getMonth()).toBe(0);
    expect(r.desde.getDate()).toBe(1);
    expect(r.etiqueta).toBe("Año 2026");
  });

  it("cruza el cambio de año sin perder meses", () => {
    const enero = new Date(2027, 0, 15);
    const r = rangoPeriodo("trimestre", enero);
    expect(r.desde.getFullYear()).toBe(2026);
    expect(r.desde.getMonth()).toBe(10); // noviembre
  });
});

describe("esPeriodo", () => {
  it("acepta sólo los períodos conocidos", () => {
    expect(esPeriodo("mes")).toBe(true);
    expect(esPeriodo("anio")).toBe(true);
    expect(esPeriodo("semana")).toBe(false);
    expect(esPeriodo(undefined)).toBe(false);
    expect(esPeriodo("")).toBe(false);
  });
});
