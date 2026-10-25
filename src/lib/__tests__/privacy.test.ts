import { describe, expect, it, beforeAll } from "vitest";
import { CONSENT_PURPOSES, docHash, docLast4, maskDoc, normalizeDoc } from "../privacy";
import { maskDoc as maskFromFormat, normalizeDoc as normalizeFromFormat } from "../doc-format";

beforeAll(() => {
  process.env.DOC_HASH_KEY = "clave-de-prueba";
});

describe("documento sin archivar", () => {
  it("normaliza puntos, espacios y guiones", () => {
    expect(normalizeDoc("30.111.222")).toBe("30111222");
    expect(normalizeDoc(" 30-111 222 ")).toBe("30111222");
  });

  it("la huella es estable y no contiene el número", () => {
    const hash = docHash("30.111.222");
    expect(hash).toBe(docHash("30111222"));
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("30111222");
  });

  it("dos documentos distintos dan huellas distintas", () => {
    expect(docHash("30111222")).not.toBe(docHash("30111223"));
  });

  it("cambiar la clave cambia la huella (no se puede adivinar sin la clave)", () => {
    const antes = docHash("30111222");
    process.env.DOC_HASH_KEY = "otra-clave";
    const despues = docHash("30111222");
    expect(despues).not.toBe(antes);
    process.env.DOC_HASH_KEY = "clave-de-prueba";
  });

  it("guarda los últimos 4 para verificar en el mostrador", () => {
    expect(docLast4("30.111.222")).toBe("1222");
  });

  it("lo que se muestra nunca es el número completo", () => {
    expect(maskDoc("1222")).toBe("DNI ····1222");
    expect(maskDoc(null)).toBe("DNI sin registrar");
    expect(maskFromFormat("1222")).toBe(maskDoc("1222"));
    expect(normalizeFromFormat("30.111.222")).toBe("30111222");
  });

  it("un documento vacío no se puede hashear", () => {
    expect(() => docHash("")).toThrow();
  });

  it("las cuatro finalidades del consentimiento están declaradas", () => {
    expect(Object.keys(CONSENT_PURPOSES)).toEqual(["DATOS_PERSONALES", "SALUD", "IMAGEN", "COMUNICACIONES"]);
  });
});
