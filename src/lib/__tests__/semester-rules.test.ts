import { describe, expect, it } from "vitest";
import { buildSemesterPayload, isSemesterPeriod, semesterBounds, semesterCsv, semesterOf } from "../semester-rules";

const club = { nombre: "Asociación Civil República ONG", cuit: "30-00000000-0", reprocannNumber: "R-1", directorMedico: "Dra. X", responsableTecnico: "Ing. Y" };

const base = {
  period: "2026-S2",
  closedAt: new Date("2026-12-31T12:00:00Z"),
  club,
  cultivation: [
    { code: "L-1", strain: "Lemon Haze", genetics: "Sativa", room: "Sala A", stage: "FLORACION", plants: 20, plantedAt: "2026-09-01", harvestedAt: null, dryWeightG: 0 },
    { code: "L-2", strain: "Lemon Haze", genetics: "Sativa", room: "Sala A", stage: "VEGETATIVO", plants: 10, plantedAt: "2026-10-01", harvestedAt: null, dryWeightG: 0 },
    { code: "L-3", strain: "CBD Critical", genetics: "Índica", room: "Sala B", stage: "PROPAGACION", plants: 5, plantedAt: "2026-11-15", harvestedAt: null, dryWeightG: 0 },
    { code: "L-4", strain: "CBD Critical", genetics: "Índica", room: null, stage: "FLORACION", plants: 7, plantedAt: "2026-08-20", harvestedAt: null, dryWeightG: 0 },
  ],
  varieties: [
    { name: "Lemon Haze", genetics: "Sativa", active: true },
    { name: "CBD Critical", genetics: "Índica", active: true },
    { name: "Vieja", genetics: null, active: false },
  ],
  harvestedGrams: 1200.456,
  dispensedGrams: 340.1,
  dispensations: 12,
  recalledBatches: 1,
};

describe("períodos semestrales", () => {
  it("S1 es enero-junio y S2 julio-diciembre", () => {
    expect(semesterOf(new Date("2026-03-10T12:00:00Z"))).toBe("2026-S1");
    expect(semesterOf(new Date("2026-06-30T23:00:00Z"))).toBe("2026-S1");
    expect(semesterOf(new Date("2026-07-01T00:30:00Z"))).toBe("2026-S2");
    expect(semesterOf(new Date("2026-12-31T12:00:00Z"))).toBe("2026-S2");
  });

  it("valida el formato", () => {
    expect(isSemesterPeriod("2026-S1")).toBe(true);
    expect(isSemesterPeriod("2026-S3")).toBe(false);
    expect(isSemesterPeriod("2026-10")).toBe(false);
    expect(() => semesterBounds("2026-10")).toThrow();
  });

  it("los límites del segundo semestre van de julio a enero", () => {
    const { start, end } = semesterBounds("2026-S2");
    expect(start.toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(end.toISOString().slice(0, 10)).toBe("2027-01-01");
  });
});

describe("armado del informe", () => {
  const payload = buildSemesterPayload(base);

  it("suma plantas totales y en floración por etapa", () => {
    expect(payload.cultivation.plantsTotal).toBe(42);
    expect(payload.cultivation.plantsFlowering).toBe(27);
    expect(payload.cultivation.byStage.PROPAGACION).toBe(5);
    expect(payload.cultivation.byStage.VEGETATIVO).toBe(10);
  });

  it("agrupa por sala y nombra la que falta", () => {
    const byRoom = Object.fromEntries(payload.cultivation.rooms.map((r) => [r.room, r]));
    expect(byRoom["Sala A"].plants).toBe(30);
    expect(byRoom["Sala A"].flowering).toBe(20);
    expect(byRoom["Sin sala asignada"].plants).toBe(7);
  });

  it("cada variedad informa sus plantas, floración y lotes", () => {
    const lemon = payload.varieties.find((v) => v.name === "Lemon Haze")!;
    expect(lemon.plantsTotal).toBe(30);
    expect(lemon.plantsFlowering).toBe(20);
    expect(lemon.batches).toBe(2);
    const cbd = payload.varieties.find((v) => v.name === "CBD Critical")!;
    expect(cbd.plantsFlowering).toBe(7);
    const vieja = payload.varieties.find((v) => v.name === "Vieja")!;
    expect(vieja.registered).toBe(false);
    expect(vieja.plantsTotal).toBe(0);
  });

  it("redondea gramos a centavos y no inventa lo que falta", () => {
    expect(payload.activity.harvestedGrams).toBe(1200.46);
    expect(payload.activity.dispensedGrams).toBe(340.1);
    expect(payload.gaps.length).toBeGreaterThan(0);
    expect(payload.from).toBe("2026-07-01");
    expect(payload.to).toBe("2026-12-31");
  });

  it("el CSV sale con ; y escapa comas", () => {
    const csv = semesterCsv({ ...payload, club: { ...payload.club, nombre: "República; ONG" } });
    expect(csv.split("\r\n").length).toBeGreaterThan(10);
    expect(csv).toContain('"República; ONG"');
    expect(csv).toContain("Plantas totales;42");
    expect(csv).toContain("Plantas en floracion;27");
  });
});
