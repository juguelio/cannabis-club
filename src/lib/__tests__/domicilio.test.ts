import { describe, expect, it } from "vitest";
import { faltaDomicilioParaEnvio, normalizarCp, validarDomicilio } from "@/lib/verificacion-rules";

/**
 * El domicilio se declara en el trámite de validación. Estas reglas deciden si el club puede despachar:
 * lo que el JEV del padrón marcó como hueco (8 de 22 legajos sin localidad o sin CP) tiene que quedar
 * cerrado por código, no por costumbre.
 */

describe("normalizarCp", () => {
  it("acepta los cuatro dígitos", () => {
    expect(normalizarCp("8370")).toBe("8370");
    expect(normalizarCp(" 1428 ")).toBe("1428");
  });

  it("toma el CPA con letras", () => {
    expect(normalizarCp("C1428ABC")).toBe("1428");
    expect(normalizarCp("b1900")).toBe("1900");
  });

  it("rechaza lo que no es un código postal", () => {
    expect(normalizarCp("")).toBeNull();
    expect(normalizarCp("abc")).toBeNull();
    expect(normalizarCp("123")).toBeNull();
  });
});

describe("validarDomicilio", () => {
  it("con retiro en el club no exige domicilio", () => {
    const r = validarDomicilio({ entrega: "RETIRO" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos).toMatchObject({ entrega: "RETIRO", address: null, postalCode: null });
  });

  it("con retiro guarda el domicilio si lo declaró, sin exigirlo", () => {
    const r = validarDomicilio({ entrega: "RETIRO", direccion: "Maipú 631", localidad: "CABA" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos.address).toBe("Maipú 631");
  });

  it("acepta un envío con calle, número, localidad, provincia y CP", () => {
    const r = validarDomicilio({
      entrega: "ENVIO",
      direccion: "Tromen 120, casa 9",
      localidad: "San Martín de los Andes",
      provincia: "Neuquén",
      codigoPostal: "8370",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos).toMatchObject({ entrega: "ENVIO", postalCode: "8370", province: "Neuquén" });
  });

  it("un envío sin número de calle no sirve para despachar", () => {
    const r = validarDomicilio({ entrega: "ENVIO", direccion: "chacra area mixta lote", localidad: "SMA", provincia: "Neuquén", codigoPostal: "8370" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problema.codigo).toBe("DOMICILIO_FALTANTE");
  });

  it("pide localidad, provincia y CP por separado", () => {
    const base = { entrega: "ENVIO" as const, direccion: "Almirante Brown 385" };
    const sinLocalidad = validarDomicilio({ ...base, provincia: "Buenos Aires", codigoPostal: "1878" });
    expect(!sinLocalidad.ok && sinLocalidad.problema.codigo).toBe("LOCALIDAD_FALTANTE");
    const sinProvincia = validarDomicilio({ ...base, localidad: "Quilmes", codigoPostal: "1878" });
    expect(!sinProvincia.ok && sinProvincia.problema.codigo).toBe("PROVINCIA_FALTANTE");
    const sinCp = validarDomicilio({ ...base, localidad: "Quilmes", provincia: "Buenos Aires" });
    expect(!sinCp.ok && sinCp.problema.codigo).toBe("CP_INVALIDO");
  });

  it("normaliza espacios repetidos", () => {
    const r = validarDomicilio({ entrega: "ENVIO", direccion: "  Los   Andes   480 ", localidad: "SMA", provincia: "Neuquén", codigoPostal: "8370" });
    expect(r.ok && r.datos.address).toBe("Los Andes 480");
  });
});

describe("faltaDomicilioParaEnvio", () => {
  it("sin dirección o sin CP no se puede enviar", () => {
    expect(faltaDomicilioParaEnvio({})).toBe(true);
    expect(faltaDomicilioParaEnvio({ address: "Los Andes 480" })).toBe(true);
    expect(faltaDomicilioParaEnvio({ postalCode: "8370" })).toBe(true);
    expect(faltaDomicilioParaEnvio({ address: "Los Andes 480", postalCode: "8370" })).toBe(false);
  });
});
