import { describe, expect, it } from "vitest";
import {
  DOCS_OBLIGATORIOS,
  estadoVerificacion,
  faltanDocumentos,
  impedimentoParaRevisar,
  normalizarDni,
  puedeOperar,
  textoFaltantes,
  validarDeclaracion,
} from "../verificacion-rules";

/**
 * Estas reglas son la puerta de la re-validación: si dejan pasar un DNI mal tipeado o un REPROCANN
 * vencido, el club recibe un expediente que no puede aprobar y el socio cree que ya está listo.
 */
const hoy = new Date("2026-11-02T12:00:00.000Z");
const base = { dni: "30.123.456", nacimiento: "1990-05-14", reprocann: "300926", vence: "2027-06-30", hoy };

describe("declaración de la re-validación", () => {
  it("normaliza el DNI dictado con puntos o espacios", () => {
    expect(normalizarDni("30.123.456")).toBe("30123456");
    expect(normalizarDni(" 12 345 678 ")).toBe("12345678");
    expect(normalizarDni("123")).toBe(null);
    expect(normalizarDni("123456789")).toBe(null);
    expect(normalizarDni("")).toBe(null);
  });

  it("acepta una declaración completa y devuelve las fechas como UTC", () => {
    const r = validarDeclaracion(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.datos.dni).toBe("30123456");
      expect(r.datos.nacimiento.toISOString()).toBe("1990-05-14T00:00:00.000Z");
      expect(r.datos.vence.toISOString()).toBe("2027-06-30T00:00:00.000Z");
    }
  });

  it("rechaza el DNI que no tiene 7 u 8 números", () => {
    const r = validarDeclaracion({ ...base, dni: "3012" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problema.codigo).toBe("DNI_INVALIDO");
  });

  it("rechaza una fecha de nacimiento futura o vacía", () => {
    const futuro = validarDeclaracion({ ...base, nacimiento: "2027-01-01" });
    expect(futuro.ok).toBe(false);
    if (!futuro.ok) expect(futuro.problema.codigo).toBe("NACIMIENTO_INVALIDO");
    const vacia = validarDeclaracion({ ...base, nacimiento: "" });
    expect(vacia.ok).toBe(false);
  });

  it("no deja presentar a un menor de la edad mínima del club", () => {
    const r = validarDeclaracion({ ...base, nacimiento: "2009-01-01", hoy: new Date("2026-11-02T12:00:00Z") });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problema.codigo).toBe("MENOR_DE_EDAD");
  });

  it("no deja presentar un REPROCANN vencido (el trámite tiene que estar al día)", () => {
    const r = validarDeclaracion({ ...base, vence: "2026-10-01" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problema.codigo).toBe("REPROCANN_VENCIDO");
      expect(r.problema.mensaje).toContain("vencido");
    }
  });

  it("el mismo día del vencimiento todavía sirve", () => {
    const r = validarDeclaracion({ ...base, vence: "2026-11-02" });
    expect(r.ok).toBe(true);
  });

  it("un número de REPROCANN vacío no es un dato", () => {
    const r = validarDeclaracion({ ...base, reprocann: "  " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problema.codigo).toBe("REPROCANN_INVALIDO");
  });
});

describe("documentos de la re-validación", () => {
  it("sin archivos faltan los tres", () => {
    expect(faltanDocumentos([])).toEqual([...DOCS_OBLIGATORIOS]);
    expect(textoFaltantes(faltanDocumentos([]))).toContain("DNI (frente)");
  });

  it("con los tres no falta nada y no hay texto", () => {
    const faltan = faltanDocumentos([...DOCS_OBLIGATORIOS]);
    expect(faltan).toEqual([]);
    expect(textoFaltantes(faltan)).toBe("");
  });

  it("un tipo desconocido no cuenta como documento válido", () => {
    expect(faltanDocumentos(["DNI_FRENTE", "DNI_DORSO", "OTRA_COSA"])).toEqual(["REPROCANN"]);
  });
});

describe("estado de la validación", () => {
  it("sólo VERIFICADO habilita operar", () => {
    expect(puedeOperar("VERIFICADO")).toBe(true);
    expect(puedeOperar("EN_REVISION")).toBe(false);
    expect(puedeOperar("PENDIENTE")).toBe(false);
    expect(puedeOperar("RECHAZADO")).toBe(false);
  });

  it("cada estado se nombra en castellano y sin decir que está validado", () => {
    expect(estadoVerificacion("EN_REVISION").label).toBe("En revisión");
    expect(estadoVerificacion("RECHAZADO").tone).toBe("danger");
    expect(estadoVerificacion("VERIFICADO").tone).toBe("ok");
    // un estado que la base devuelva de más no habilita nada
    expect(puedeOperar(estadoVerificacion("LO_QUE_SEA").label)).toBe(false);
  });
});

describe("expediente que el club puede tocar", () => {
  const enRevision = { status: "EN_REVISION" as const, supersededAt: null };

  it("la última presentación en revisión se aprueba o se rechaza", () => {
    expect(impedimentoParaRevisar(enRevision)).toBe(null);
  });

  it("una presentación supersedida no se toca aunque siga en revisión", () => {
    // Es el caso del reenvío: el socio presentó de nuevo y la anterior quedó atrás sin que nadie la decidiera.
    expect(impedimentoParaRevisar({ ...enRevision, supersededAt: new Date("2026-11-25T20:43:00Z") })).toBe("SUPERSEDIDA");
    // Y gana sobre «ya revisada»: lo primero que hay que decir es que la reemplazaron.
    expect(
      impedimentoParaRevisar({ status: "RECHAZADO", supersededAt: new Date("2026-11-25T20:43:00Z") }),
    ).toBe("SUPERSEDIDA");
  });

  it("un rechazo del club ya decidido no se revisa dos veces", () => {
    expect(impedimentoParaRevisar({ status: "RECHAZADO", supersededAt: null })).toBe("RESUELTA");
    expect(impedimentoParaRevisar({ status: "VERIFICADO", supersededAt: null })).toBe("RESUELTA");
  });
});
