import { describe, expect, it } from "vitest";
import { canonicalJson, hashPayload, integrity, periodBounds } from "../monthly-close";

describe("cierre mensual firmado", () => {
  it("la huella no depende del orden de las claves", () => {
    expect(hashPayload({ b: 2, a: 1 })).toBe(hashPayload({ a: 1, b: 2 }));
  });

  it("la huella no depende del orden de los elementos de un array", () => {
    expect(hashPayload({ xs: [1, 2] })).not.toBe(hashPayload({ xs: [2, 1] }));
  });

  it("cambiar un número cambia la huella", () => {
    expect(hashPayload({ entregas: { gramos: 100 } })).not.toBe(hashPayload({ entregas: { gramos: 101 } }));
  });

  it("detecta un payload manipulado después de firmar", () => {
    const payload = { entregas: { gramos: 100 }, periodo: "2026-10" };
    const hash = hashPayload(payload);
    expect(integrity({ payload, hash }).ok).toBe(true);
    expect(integrity({ payload: { ...payload, entregas: { gramos: 999 } }, hash }).ok).toBe(false);
  });

  it("ignora las claves indefinidas al calcular la huella", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it("el período se corta en la zona del club y no en UTC", () => {
    const { start, end } = periodBounds("2026-10");
    expect(start.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("rechaza un período mal escrito", () => {
    expect(() => periodBounds("2026-13")).toThrow();
  });
});
