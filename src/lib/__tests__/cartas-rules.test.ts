import { describe, expect, it } from "vitest";
import {
  faltantesDeCarta,
  puedeAprobarse,
  puedeEditarse,
  puedeEnviarse,
  repartirCarta,
  type CandidatoCarta,
  type ContenidoCarta,
} from "../cartas-rules";

const base: ContenidoCarta = {
  edicion: "noviembre 2026",
  titulo: "El mes en que el club se ordena",
  copete: "Lo que cambió este mes.",
  apertura: ["Primer párrafo."],
  bloques: [{ titulo: "Tu REPROCANN", texto: "Renovalo antes de que venza." }],
  cta: { texto: "Entrar al portal", url: "https://republicacannabis.com.ar/portal" },
};

describe("contenido de la carta", () => {
  it("una carta completa no tiene faltantes", () => {
    expect(faltantesDeCarta(base)).toEqual([]);
  });

  it("sin título, sin bajada o sin bloques no se publica", () => {
    expect(faltantesDeCarta({ ...base, titulo: " " }).join(" ")).toContain("Falta el título");
    expect(faltantesDeCarta({ ...base, copete: "" }).join(" ")).toContain("Falta la bajada");
    expect(faltantesDeCarta({ ...base, bloques: [] }).join(" ")).toContain("al menos un bloque");
    expect(faltantesDeCarta({ ...base, apertura: ["  "] }).join(" ")).toContain("primer párrafo");
  });

  it("un bloque a medias se marca con su número", () => {
    const faltan = faltantesDeCarta({ ...base, bloques: [{ titulo: "Uno", texto: "ok" }, { titulo: "", texto: "sin título" }] });
    expect(faltan.join(" ")).toContain("bloque 2 no tiene título");
  });

  it("un enlace sin http no pasa: el correo no puede tener links relativos", () => {
    const faltan = faltantesDeCarta({ ...base, cta: { texto: "Ver", url: "/portal" } });
    expect(faltan.join(" ")).toContain("empiece con http");
  });

  it("no se aceptan más bloques que el máximo", () => {
    const muchos = Array.from({ length: 7 }, (_, i) => ({ titulo: `B${i}`, texto: "texto" }));
    expect(faltantesDeCarta({ ...base, bloques: muchos }).join(" ")).toContain("máximo es 6");
  });
});

describe("estados de la carta", () => {
  it("se edita y se aprueba sólo desde borrador", () => {
    expect(puedeEditarse("BORRADOR")).toBe(true);
    expect(puedeEditarse("APROBADA")).toBe(false);
    expect(puedeAprobarse("BORRADOR")).toBe(true);
    expect(puedeAprobarse("ENVIADA")).toBe(false);
  });

  it("se envía si está aprobada, y también si quedó a mitad (para retomar)", () => {
    expect(puedeEnviarse("APROBADA")).toBe(true);
    expect(puedeEnviarse("ENVIANDO")).toBe(true);
    expect(puedeEnviarse("BORRADOR")).toBe(false);
    expect(puedeEnviarse("ENVIADA")).toBe(false);
  });
});

describe("a quién le llega la carta", () => {
  const socio = (over: Partial<CandidatoCarta>): CandidatoCarta => ({
    id: "m1", legajo: 1, nombre: "Ana Pérez", email: "ana@correo.test", status: "ACTIVO", comunicaciones: true, ...over,
  });

  it("pasa el socio activo, con email y con consentimiento", () => {
    const r = repartirCarta([socio({})]);
    expect(r.alcanzables).toHaveLength(1);
    expect(r.excluidos).toEqual([]);
  });

  it("quedan afuera el que no consintió, el que no tiene email y el que no está activo", () => {
    const r = repartirCarta([
      socio({ id: "a", legajo: 1 }),
      socio({ id: "b", legajo: 2, comunicaciones: false }),
      socio({ id: "c", legajo: 3, email: null }),
      socio({ id: "d", legajo: 4, status: "PENDIENTE" }),
      socio({ id: "e", legajo: 5, status: "BAJA" }),
    ]);
    expect(r.alcanzables.map((c) => c.legajo)).toEqual([1]);
    const motivos = Object.fromEntries(r.excluidos.map((e) => [e.legajo, e.motivo]));
    expect(motivos[2]).toBe("sin consentimiento de comunicaciones");
    expect(motivos[3]).toBe("no tiene email");
    expect(motivos[4]).toBe("legajo pendiente");
    expect(motivos[5]).toBe("legajo baja");
  });

  it("el orden del padrón se respeta: la consola lista por legajo", () => {
    const r = repartirCarta([socio({ id: "x", legajo: 9 }), socio({ id: "y", legajo: 2 })]);
    expect(r.alcanzables.map((c) => c.legajo)).toEqual([9, 2]);
  });
});
