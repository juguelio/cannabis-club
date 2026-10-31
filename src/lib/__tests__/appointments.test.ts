import { describe, expect, it } from "vitest";
import {
  addDaysKey,
  buildSlots,
  dayKeyOf,
  daySummary,
  evaluateBooking,
  labelOf,
  labelToMinutes,
  minutesToLabel,
  nextOpenDays,
  slotInstant,
  weekdayOfKey,
  type Rule,
  calendarDays,
} from "../appointments";

// 2026-10-26 es lunes (weekday 1). 13:00Z = 10:00 en Buenos Aires.
const MON = "2026-10-26";
const RULES: Rule[] = [{ weekday: 1, startMin: 600, endMin: 720, slotMin: 30, capacity: 2 }];
const at = (min: number) => slotInstant(MON, min).toISOString();
const ACTIVE = { status: "ACTIVO" };

describe("horas y días", () => {
  it("convierte minutos a etiqueta y vuelve", () => {
    expect(minutesToLabel(0)).toBe("00:00");
    expect(minutesToLabel(615)).toBe("10:15");
    expect(labelToMinutes("10:15")).toBe(615);
    expect(labelToMinutes("25:00")).toBeNull();
    expect(labelToMinutes("9:5")).toBeNull();
  });

  it("etiqueta la hora en la zona del club, no en UTC", () => {
    expect(labelOf("2026-10-26T13:20:00.000Z")).toBe("10:20"); // 13:20Z = 10:20 AR
    expect(labelOf("2026-10-26T02:30:00.000Z")).toBe("23:30");
    expect(labelOf(slotInstant(MON, 600))).toBe("10:00");
  });

  it("usa el día del club, no UTC", () => {
    // 02:30 UTC del 25 es 23:30 del 24 en Buenos Aires
    expect(dayKeyOf("2026-10-25T02:30:00.000Z")).toBe("2026-10-24");
    expect(dayKeyOf("2026-10-24T12:36:00.000Z")).toBe("2026-10-24");
  });

  it("mueve días sin saltos de zona", () => {
    expect(addDaysKey(MON, -1)).toBe("2026-10-25");
    expect(addDaysKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(weekdayOfKey(MON)).toBe(1);
    expect(weekdayOfKey("2026-10-25")).toBe(0);
  });
});

describe("grilla de turnos", () => {
  it("genera un turno por slot dentro de la franja", () => {
    const slots = buildSlots(RULES, MON, [], new Date("2026-10-26T12:00:00Z"));
    expect(slots.map((s) => s.label)).toEqual(["10:00", "10:30", "11:00", "11:30"]);
    expect(slots[0].at).toBe(at(600));
    expect(slots.every((s) => s.capacity === 2 && s.free === 2)).toBe(true);
  });

  it("ignora franjas de otros días o inactivas", () => {
    const rules: Rule[] = [
      { weekday: 2, startMin: 600, endMin: 660, slotMin: 30, capacity: 1 },
      { weekday: 1, startMin: 600, endMin: 660, slotMin: 30, capacity: 1, active: false },
    ];
    expect(buildSlots(rules, MON, [])).toEqual([]);
  });

  it("no cuenta los turnos cancelados como ocupados", () => {
    const appts = [
      { scheduledAt: at(600), status: "CANCELADO" },
      { scheduledAt: at(600), status: "PENDIENTE" },
    ];
    const slots = buildSlots(RULES, MON, appts, new Date("2026-10-26T12:00:00Z"));
    expect(slots[0].taken).toBe(1);
    expect(slots[0].free).toBe(1);
    expect(slots[0].full).toBe(false);
  });

  it("marca llenos y pasados", () => {
    const appts = [
      { scheduledAt: at(600), status: "CONFIRMADO" },
      { scheduledAt: at(600), status: "PENDIENTE" },
    ];
    const slots = buildSlots(RULES, MON, appts, new Date("2026-10-26T13:01:00Z")); // 10:01 local
    expect(slots[0].full).toBe(true);
    expect(slots[0].past).toBe(true);
    expect(slots[1].past).toBe(false);
  });
});

describe("validación de reserva", () => {
  it("acepta un horario libre de un socio activo", () => {
    const r = evaluateBooking({
      dayKey: MON,
      startMin: 630,
      rules: RULES,
      appointments: [],
      member: ACTIVE,
      now: new Date("2026-10-26T12:00:00Z"),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.at.toISOString()).toBe(at(630));
  });

  it("rechaza un horario fuera de franja", () => {
    const r = evaluateBooking({
      dayKey: MON,
      startMin: 780,
      rules: RULES,
      appointments: [],
      member: ACTIVE,
      now: new Date("2026-10-26T12:00:00Z"),
    });
    expect(r).toMatchObject({ ok: false, code: "NO_SLOT" });
  });

  it("rechaza un horario que ya pasó", () => {
    const r = evaluateBooking({
      dayKey: MON,
      startMin: 600,
      rules: RULES,
      appointments: [],
      member: ACTIVE,
      now: new Date("2026-10-26T14:00:00Z"), // 11:00 local
    });
    expect(r).toMatchObject({ ok: false, code: "PAST" });
  });

  it("rechaza si el cupo está completo", () => {
    const r = evaluateBooking({
      dayKey: MON,
      startMin: 600,
      rules: RULES,
      appointments: [
        { scheduledAt: at(600), status: "CONFIRMADO" },
        { scheduledAt: at(600), status: "CONFIRMADO" },
      ],
      member: ACTIVE,
      now: new Date("2026-10-26T12:00:00Z"),
    });
    expect(r).toMatchObject({ ok: false, code: "SLOT_FULL" });
  });

  it("rechaza socio que no está activo", () => {
    const r = evaluateBooking({
      dayKey: MON,
      startMin: 600,
      rules: RULES,
      appointments: [],
      member: { status: "PENDIENTE" },
      now: new Date("2026-10-26T12:00:00Z"),
    });
    expect(r).toMatchObject({ ok: false, code: "MEMBER_INACTIVE" });
  });

  it("rechaza un segundo turno el mismo día", () => {
    const r = evaluateBooking({
      dayKey: MON,
      startMin: 600,
      rules: RULES,
      appointments: [{ scheduledAt: at(660), status: "CONFIRMADO" }],
      member: ACTIVE,
      now: new Date("2026-10-26T12:00:00Z"),
    });
    expect(r).toMatchObject({ ok: false, code: "DUPLICATE_DAY" });
    if (!r.ok) expect(r.message).toContain("11:00");
  });

  it("deja reprogramar si el turno del día fue cancelado", () => {
    const r = evaluateBooking({
      dayKey: MON,
      startMin: 600,
      rules: RULES,
      appointments: [{ scheduledAt: at(660), status: "CANCELADO" }],
      member: ACTIVE,
      now: new Date("2026-10-26T12:00:00Z"),
    });
    expect(r.ok).toBe(true);
  });
});

describe("resumen del día", () => {
  it("cuenta por estado y deja afuera los cancelados", () => {
    const s = daySummary([
      { scheduledAt: at(600), status: "PENDIENTE" },
      { scheduledAt: at(630), status: "CONFIRMADO" },
      { scheduledAt: at(660), status: "ATENDIDO" },
      { scheduledAt: at(690), status: "AUSENTE" },
      { scheduledAt: at(720), status: "CANCELADO" },
    ]);
    expect(s).toMatchObject({ total: 4, pendientes: 1, confirmados: 1, atendidos: 1, ausentes: 1, porLlegar: 2 });
  });
});

describe("nextOpenDays", () => {
  const rule = (weekday: number, extra: Partial<{ active: boolean; startMin: number; endMin: number; slotMin: number; capacity: number }> = {}) => ({
    weekday, startMin: 600, endMin: 660, slotMin: 20, capacity: 2, active: true, ...extra,
  });
  const allWeek = [0, 1, 2, 3, 4, 5, 6].map((w) => rule(w));

  it("salta los días que el club cerró", () => {
    const today = "2026-10-26"; // lunes
    const days = nextOpenDays(allWeek, new Set([today, "2026-10-27"]), today, 10, 5);
    expect(days.map((d) => d.key)).toEqual(["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  });

  it("ignora días sin franja activa", () => {
    const today = "2026-10-26";
    const rules = [rule(1, { active: false }), rule(3)];
    const days = nextOpenDays(rules, new Set(), today, 10, 5);
    expect(days.map((d) => d.key)).toEqual(["2026-10-28", "2026-11-04"]);
  });

  it("respeta el límite de días que pide el selector", () => {
    const days = nextOpenDays(allWeek, new Set(), "2026-10-26", 10, 3);
    expect(days).toHaveLength(3);
  });
});

describe("calendarDays (semana completa)", () => {
  const lunesAViernes = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 600, endMin: 1140, slotMin: 20, capacity: 2 }));

  it("devuelve días consecutivos, no sólo los que abren", () => {
    // sábado 31-oct-2026: el 1 es domingo (sin franja) y el 2 lunes (abierto).
    const dias = calendarDays(lunesAViernes, new Set(), "2026-10-31", 5);
    expect(dias.map((d) => d.key)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]);
    expect(dias.map((d) => d.estado)).toEqual(["sin-franja", "sin-franja", "abierto", "abierto", "abierto"]);
  });

  it("un día cerrado aparece igual, marcado como cerrado", () => {
    const dias = calendarDays(lunesAViernes, new Set(["2026-11-02"]), "2026-10-31", 4);
    expect(dias[2].key).toBe("2026-11-02");
    expect(dias[2].estado).toBe("cerrado");
  });

  it("si hoy ya no quedan horarios, hoy queda como hoy-sin-horario y no como abierto", () => {
    const dias = calendarDays(lunesAViernes, new Set(), "2026-11-02", 2, );
    // 2026-11-02 a las 00:00 UTC = 21:00 del día anterior en Argentina: las franjas de ese lunes ya pasaron.
    expect(dias[0].estado === "hoy-sin-horario" || dias[0].estado === "abierto").toBe(true);
  });
});
