import { describe, expect, it } from "vitest";
import { DOC_TIPOS, encryptDoc, decryptDoc, encryptText, decryptText, sha256, MAX_DOC_BYTES, DOC_MIMES } from "../docs-crypto";
import {
  AFFIDAVIT_VERSION,
  edadEn,
  faltantesParaAprobar,
  legajoSiguiente,
  limitesFechasAlta,
  soloDigitos,
  validarRechazo,
  validarSolicitud,
  type SolicitudInput,
} from "../access-request";

const hoy = new Date("2026-10-26T12:00:00Z");

const base: SolicitudInput = {
  firstName: "María",
  lastName: "Quiroga",
  birthDate: "1990-04-12",
  phone: "294 412 3456",
  address: "Roca 123",
  locality: "San Martín de los Andes",
  docNumber: "30.123.456",
  reprocannNumber: "REP-000123",
  reprocannExpiresAt: "2027-03-01",
  affidavitAccepted: true,
};

describe("validarSolicitud", () => {
  it("una solicitud completa no tiene errores", () => {
    expect(validarSolicitud(base, hoy)).toEqual([]);
  });

  it("exige mayoría de edad y no acepta fechas futuras", () => {
    const menor = validarSolicitud({ ...base, birthDate: "2012-01-01" }, hoy);
    expect(menor.map((e) => e.campo)).toContain("birthDate");
    expect(menor.find((e) => e.campo === "birthDate")?.mensaje).toMatch(/18/);

    const futuro = validarSolicitud({ ...base, birthDate: "2027-01-01" }, hoy);
    expect(futuro.find((e) => e.campo === "birthDate")?.mensaje).toMatch(/futura/);
  });

  it("el DNI tiene que tener 7 u 8 dígitos", () => {
    expect(validarSolicitud({ ...base, docNumber: "123" }, hoy).map((e) => e.campo)).toContain("docNumber");
    expect(validarSolicitud({ ...base, docNumber: "3012345" }, hoy)).toEqual([]);
  });

  it("rechaza fechas imposibles aunque JavaScript pueda normalizarlas", () => {
    const errores = validarSolicitud({ ...base, birthDate: "1990-02-30", reprocannExpiresAt: "2027-02-29" }, hoy);
    expect(errores.map(error => error.campo)).toEqual(["birthDate", "reprocannExpiresAt"]);
  });

  it("el calendario admite el cumpleaños 18 y el vencimiento de hoy incluso en años bisiestos", () => {
    for (const [hoyISO, corte] of [["2024-02-29", "2006-02-28"], ["2026-02-28", "2008-02-28"], ["2026-03-01", "2008-03-01"]]) {
      const dia = new Date(hoyISO + "T12:00:00Z");
      expect(limitesFechasAlta(dia)).toEqual({ hoy: hoyISO, nacimientoMaximo: corte });
      expect(validarSolicitud({ ...base, birthDate: corte, reprocannExpiresAt: hoyISO }, dia)).toEqual([]);
    }
  });

  it("un REPROCANN vencido no se puede presentar", () => {
    const r = validarSolicitud({ ...base, reprocannExpiresAt: "2026-01-01" }, hoy);
    expect(r.find((e) => e.campo === "reprocannExpiresAt")?.mensaje).toMatch(/vencido/);
  });

  it("sin aceptar la DDJJ no avanza", () => {
    expect(validarSolicitud({ ...base, affidavitAccepted: false }, hoy).map((e) => e.campo)).toContain("affidavitAccepted");
  });

  it("junta varios errores de una vez", () => {
    const r = validarSolicitud({}, hoy);
    expect(r.length).toBeGreaterThanOrEqual(6);
  });
});

describe("aprobación", () => {
  it("exige los tres archivos", () => {
    const faltan = faltantesParaAprobar({ status: "PENDIENTE", tiposCargados: ["DNI_FRENTE"], docLast4: "3456" });
    expect(faltan.join(" ")).toMatch(/DNI_DORSO/);
    expect(faltan.join(" ")).toMatch(/REPROCANN/);
  });

  it("con todo cargado no falta nada", () => {
    expect(faltantesParaAprobar({ status: "PENDIENTE", tiposCargados: [...DOC_TIPOS], docLast4: "3456" })).toEqual([]);
  });

  it("no se aprueba dos veces", () => {
    const faltan = faltantesParaAprobar({ status: "APROBADA", tiposCargados: [...DOC_TIPOS], docLast4: "3456" });
    expect(faltan.join(" ")).toMatch(/ya está resuelta/);
  });

  it("el rechazo necesita un motivo legible", () => {
    expect(validarRechazo("")).toMatch(/motivo/);
    expect(validarRechazo("corto")).toMatch(/mínimo 10/);
    expect(validarRechazo("El DNI está ilegible, mandá una foto derecha y con luz")).toBeNull();
  });

  it("el legajo siguiente no reutiliza números", () => {
    expect(legajoSiguiente([])).toBe(1);
    expect(legajoSiguiente([1, 2, 7])).toBe(8);
  });

  it("calcula la edad sin corrimientos de zona horaria", () => {
    expect(edadEn(new Date("2008-10-26T00:00:00Z"), hoy)).toBe(18);
    expect(edadEn(new Date("2008-10-27T00:00:00Z"), hoy)).toBe(17);
  });

  it("normaliza el documento", () => {
    expect(soloDigitos("30.123.456")).toBe("30123456");
  });
});

describe("cifrado de documentos", () => {
  it("cifra y descifra un archivo", () => {
    process.env.DOC_ENC_KEY = Buffer.alloc(32, 7).toString("base64");
    const original = Buffer.from("foto del dni", "utf8");
    const { data, iv, tag } = encryptDoc(original);
    expect(data.equals(original)).toBe(false);
    expect(decryptDoc({ data, iv, tag }).toString("utf8")).toBe("foto del dni");
  });

  it("cifra y descifra el número de documento", () => {
    process.env.DOC_ENC_KEY = Buffer.alloc(32, 9).toString("base64");
    const packed = encryptText("30123456");
    expect(decryptText(packed)).toBe("30123456");
  });

  it("detecta el archivo alterado (GCM autentica)", () => {
    process.env.DOC_ENC_KEY = Buffer.alloc(32, 3).toString("base64");
    const { data, iv, tag } = encryptDoc(Buffer.from("x"));
    data[0] = data[0] ^ 0xff;
    expect(() => decryptDoc({ data, iv, tag })).toThrow();
  });

  it("la huella es estable y no reversible", () => {
    const a = sha256(Buffer.from("hola"));
    expect(a).toBe(sha256(Buffer.from("hola")));
    expect(a).toHaveLength(64);
    expect(a).not.toContain("hola");
  });

  it("los límites son los declarados", () => {
    expect(MAX_DOC_BYTES).toBe(6 * 1024 * 1024);
    expect(DOC_MIMES).toContain("application/pdf");
    expect(AFFIDAVIT_VERSION).toMatch(/^\d{4}-\d{2}$/);
  });
});
