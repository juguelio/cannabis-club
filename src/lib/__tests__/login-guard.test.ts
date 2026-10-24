import { describe, expect, it } from "vitest";
import { lockoutDecision, MAX_FAILURES, WINDOW_MIN } from "../login-guard";

describe("freno de intentos de ingreso", () => {
  const now = new Date("2026-10-24T20:00:00Z");
  it("deja pasar por debajo del límite", () => {
    expect(lockoutDecision(MAX_FAILURES - 1, new Date(now.getTime() - 60_000), now)).toEqual({ locked: false });
  });
  it("bloquea al llegar al límite y dice cuánto falta", () => {
    const oldest = new Date(now.getTime() - 5 * 60_000);
    expect(lockoutDecision(MAX_FAILURES, oldest, now)).toEqual({ locked: true, minutes: WINDOW_MIN - 5 });
  });
});
