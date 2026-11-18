import { describe, expect, it } from "vitest";
import { cierreReserva, draftLines, gramsOf, lineProblems, pickupCoverage, setProblems, totalGrams, type BatchLite, type PickupItemLite } from "../pickup-lines";

const cbd: PickupItemLite = { id: "i1", strainId: "s1", strainName: "CBD Therapy", grams: 5 };
const lemon: PickupItemLite = { id: "i2", strainId: "s2", strainName: "Lemon Haze", grams: 5 };
const north: PickupItemLite = { id: "i3", strainId: "s3", strainName: "Northern Lights", grams: 5 };
const items = [cbd, lemon, north];

const batches: BatchLite[] = [
  { id: "b1", code: "L-001", strainId: "s1", balanceG: 40, thcPct: 0.5 },
  { id: "b2", code: "L-002", strainId: "s2", balanceG: 3, thcPct: 18 },
  { id: "b3", code: "L-003", strainId: "s3", balanceG: 25, thcPct: null },
  { id: "b4", code: "L-004", strainId: "s1", balanceG: 0, thcPct: 0.4 },
];

const limits = { perOrderG: 25, monthlyG: 50, usage: { dayGrams: 0, monthGrams: 0 }, thcMaxPct: null };

describe("borrador de filas por variedad", () => {
  it("arma una fila por variedad reservada, con la cantidad reservada puesta y sin lote", () => {
    const lines = draftLines(items);
    expect(lines.map((l) => l.strainName)).toEqual(["CBD Therapy", "Lemon Haze", "Northern Lights"]);
    expect(lines.map((l) => l.grams)).toEqual(["5", "5", "5"]);
    expect(lines.every((l) => l.batchId === "")).toBe(true);
  });

  it("no preselecciona lote aunque haya uno solo con saldo de esa genética", () => {
    const [line] = draftLines([cbd]);
    expect(line.batchId).toBe("");
  });
});

describe("problemas de una fila", () => {
  it("pide el lote cuando no se eligió", () => {
    const problems = lineProblems(draftLines([cbd])[0], batches, limits);
    expect(problems.some((p) => p.tone === "bad" && p.text.includes("Elegí el lote de CBD Therapy"))).toBe(true);
  });

  it("rechaza un lote de otra genética", () => {
    const line = { ...draftLines([cbd])[0], batchId: "b2" };
    const problems = lineProblems(line, batches, limits);
    expect(problems.some((p) => p.text.includes("no es de CBD Therapy"))).toBe(true);
  });

  it("rechaza más gramos que el saldo del lote", () => {
    const line = { ...draftLines([lemon])[0], batchId: "b2", grams: "6" };
    const problems = lineProblems(line, batches, limits);
    expect(problems.some((p) => p.tone === "bad" && p.text.includes("tiene 3 g"))).toBe(true);
  });

  it("no ofrece un lote sin saldo como si sirviera", () => {
    const line = { ...draftLines([cbd])[0], batchId: "b4" };
    const problems = lineProblems(line, batches, limits);
    expect(problems.some((p) => p.tone === "bad")).toBe(true);
  });

  it("con máximo de THC, un lote sin análisis queda bloqueado (dato faltante no es aprobado)", () => {
    const line = { ...draftLines([north])[0], batchId: "b3" };
    const problems = lineProblems(line, batches, { ...limits, thcMaxPct: 10 });
    expect(problems.some((p) => p.text.includes("no tiene THC cargado"))).toBe(true);
  });

  it("entregar distinto de lo reservado se avisa pero no bloquea", () => {
    const line = { ...draftLines([cbd])[0], batchId: "b1", grams: "3" };
    const problems = lineProblems(line, batches, limits);
    expect(problems.filter((p) => p.tone === "bad")).toHaveLength(0);
    expect(problems.some((p) => p.tone === "warn" && p.text.includes("menos"))).toBe(true);
  });
});

describe("problemas del conjunto", () => {
  it("marca el mismo lote dos veces", () => {
    const lines = [
      { ...draftLines([cbd])[0], batchId: "b1", grams: "5" },
      { ...draftLines([cbd])[0], pickupItemId: "i9", strainName: "Otra", batchId: "b1", grams: "5" },
    ];
    expect(setProblems(lines, limits).some((p) => p.text.includes("se repite"))).toBe(true);
  });

  it("mide los topes sobre la suma de las filas, no fila por fila", () => {
    const lines = draftLines(items).map((l, i) => ({ ...l, batchId: ["b1", "b2", "b3"][i], grams: "10" }));
    const problems = setProblems(lines, limits);
    expect(problems.some((p) => p.tone === "bad" && p.text.includes("tope por pedido"))).toBe(true);
  });

  it("no bloquea 15 g de una reserva de 15 g con topes de 25/50", () => {
    const lines = draftLines(items).map((l, i) => ({ ...l, batchId: ["b1", "b2", "b3"][i], grams: "5" }));
    expect(setProblems(lines, limits).filter((p) => p.tone === "bad")).toHaveLength(0);
    expect(totalGrams(lines)).toBe(15);
  });
});

describe("cobertura de la reserva", () => {
  it("está completa cuando todas las variedades tienen lote y gramos", () => {
    const lines = draftLines(items).map((l, i) => ({ ...l, batchId: ["b1", "b2", "b3"][i], grams: "5" }));
    const cov = pickupCoverage(items, lines);
    expect(cov).toEqual({ reservedG: 15, assignedG: 15, differenceG: 0, complete: true, pending: [] });
  });

  it("queda abierta y dice qué falta si una variedad no tiene lote", () => {
    const lines = draftLines(items).map((l, i) => ({ ...l, batchId: ["b1", "", "b3"][i], grams: "5" }));
    const cov = pickupCoverage(items, lines);
    expect(cov.complete).toBe(false);
    expect(cov.pending).toEqual(["Lemon Haze"]);
  });

  it("registra la diferencia cuando se entrega distinto de lo reservado", () => {
    const lines = draftLines(items).map((l, i) => ({ ...l, batchId: ["b1", "b2", "b3"][i], grams: i === 0 ? "2" : "5" }));
    const cov = pickupCoverage(items, lines);
    expect(cov.complete).toBe(true);
    expect(cov.differenceG).toBe(-3);
  });

  it("una reserva sin ítems nunca queda cubierta", () => {
    expect(pickupCoverage([], []).complete).toBe(false);
  });
});

describe("gramos escritos a mano", () => {
  it("acepta coma decimal y descarta lo que no es número", () => {
    expect(gramsOf("5,5")).toBe(5.5);
    expect(gramsOf("")).toBe(0);
    expect(gramsOf("-3")).toBe(0);
  });
});

describe("cierre de la reserva atendida en varias entregas", () => {
  const reserva = [
    { id: "i1", strainId: "s3", strainName: "Northern Lights", grams: 2 },
    { id: "i2", strainId: "s2", strainName: "Lemon Haze", grams: 4 },
  ];

  it("no marca apartamiento cuando las entregas suman lo reservado", () => {
    const cierre = cierreReserva(reserva, [2, 4]);
    expect(cierre.reservadoG).toBe(6);
    expect(cierre.imputadoG).toBe(6);
    expect(cierre.differenceG).toBe(0);
    expect(cierre.apartamiento).toBe(false);
    expect(cierre.faltaG).toBe(0);
  });

  it("mide el faltante sobre todas las entregas, no sobre la última", () => {
    // La última entrega son 4 g de una reserva de 6: si se comparara sólo con ella aparecería un
    // faltante de 2 g aunque el socio ya se llevó los 2 g de la primera variedad días antes.
    const cierre = cierreReserva(reserva, [2, 4]);
    expect(cierre.differenceG).not.toBe(-2);
    const parcial = cierreReserva(reserva, [4]);
    expect(parcial.apartamiento).toBe(true);
    expect(parcial.differenceG).toBe(-2);
    expect(parcial.faltaG).toBe(2);
  });

  it("registra la entrega de más sin pedir nada pendiente", () => {
    const cierre = cierreReserva(reserva, [2, 5]);
    expect(cierre.differenceG).toBe(1);
    expect(cierre.apartamiento).toBe(true);
    expect(cierre.faltaG).toBe(0);
  });
});
