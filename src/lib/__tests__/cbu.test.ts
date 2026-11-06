import { describe, expect, it } from "vitest";
import { formatearCbu } from "../cbu";

describe("formatearCbu", () => {
  it("un CBU de 22 dígitos se lee en dos bloques", () => {
    expect(formatearCbu("0000003100012345678901")).toBe("00000031 00012345678901");
  });

  it("si ya viene con espacios, se normaliza igual", () => {
    expect(formatearCbu("00000031 00012345678901")).toBe("00000031 00012345678901");
  });

  it("un CBU corto o vacío se deja como está: no se inventan dígitos", () => {
    expect(formatearCbu("12345")).toBe("12345");
    expect(formatearCbu(null)).toBe("");
  });
});
