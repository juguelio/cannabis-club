import { describe, expect, it } from "vitest";
import { esDocumentoDelMismoLegajo, esReclamoDeLegajo } from "@/lib/access-request";

/**
 * El padrón trae socios que existen desde antes del sistema y no tienen cuenta. Cuando entran con Google no hay
 * que crearles otro legajo: reclaman el suyo. Estas dos reglas son las que deciden cuándo.
 */

describe("esReclamoDeLegajo", () => {
  it("reconoce al socio importado por su email, sin importar mayúsculas", () => {
    expect(esReclamoDeLegajo({ emailPadron: "Ima.Mesa@gmail.com", emailCuenta: "ima.mesa@gmail.com", yaTieneCuenta: false })).toBe(true);
  });

  it("no reclama si el legajo ya tiene cuenta", () => {
    expect(esReclamoDeLegajo({ emailPadron: "a@b.com", emailCuenta: "a@b.com", yaTieneCuenta: true })).toBe(false);
  });

  it("sin email en el padrón es un alta normal", () => {
    expect(esReclamoDeLegajo({ emailPadron: null, emailCuenta: "nuevo@mail.com", yaTieneCuenta: false })).toBe(false);
    expect(esReclamoDeLegajo({ emailPadron: "", emailCuenta: "nuevo@mail.com", yaTieneCuenta: false })).toBe(false);
  });

  it("un email distinto no reclama el legajo de otro", () => {
    expect(esReclamoDeLegajo({ emailPadron: "otro@mail.com", emailCuenta: "yo@mail.com", yaTieneCuenta: false })).toBe(false);
  });
});

describe("esDocumentoDelMismoLegajo", () => {
  it("el documento que ya está en el legajo reclamado no es un duplicado", () => {
    expect(esDocumentoDelMismoLegajo({ legajoDelDocumento: 6, legajoReclamado: 6 })).toBe(true);
  });

  it("un documento de otro legajo sí es duplicado", () => {
    expect(esDocumentoDelMismoLegajo({ legajoDelDocumento: 9, legajoReclamado: 6 })).toBe(false);
  });

  it("sin documento previo no hay nada que comparar", () => {
    expect(esDocumentoDelMismoLegajo({ legajoDelDocumento: null, legajoReclamado: 6 })).toBe(false);
    expect(esDocumentoDelMismoLegajo({ legajoDelDocumento: 6, legajoReclamado: null })).toBe(false);
  });
});
