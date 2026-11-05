import { describe, expect, it } from "vitest";
import { cambios, faltaParaEnvio, normalizarDatosOperativos } from "../mis-datos";

/**
 * El caso que estos tests fijan es el del socio verificado con el código postal vacío: no podía
 * pedir un envío y el portal lo mandaba a una pantalla que no existe para él. Lo que se prueba acá
 * es que el domicilio se puede completar de a partes, sin exigir todo ni aceptar media dirección.
 */
describe("normalizarDatosOperativos", () => {
  it("acepta un domicilio completo y normaliza el CPA a cuatro números", () => {
    const r = normalizarDatosOperativos({
      address: "Los Notros 195",
      locality: "San Martín de los Andes",
      province: "Neuquén",
      postalCode: "Q8370ABC",
      phone: "2944 15 8559",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.datos.postalCode).toBe("8370");
      expect(r.datos.address).toBe("Los Notros 195");
    }
  });

  it("deja pasar el domicilio vacío: el que sólo retira en el club no necesita código postal", () => {
    const r = normalizarDatosOperativos({ address: "", postalCode: "" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.datos.address).toBeNull();
      expect(r.datos.postalCode).toBeNull();
    }
  });

  it("no acepta la calle sin número", () => {
    const r = normalizarDatosOperativos({ address: "Los Notros" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemas[0].campo).toBe("address");
  });

  it("no acepta un código postal que no tenga cuatro números", () => {
    const r = normalizarDatosOperativos({ postalCode: "83" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemas[0].campo).toBe("postalCode");
  });

  it("no acepta un teléfono a medias", () => {
    const r = normalizarDatosOperativos({ phone: "294" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemas[0].campo).toBe("phone");
  });
});

describe("faltaParaEnvio", () => {
  it("con calle y código postal alcanza para despachar", () => {
    expect(faltaParaEnvio({ address: "Los Notros 195", postalCode: "8370" })).toBe(false);
  });

  it("sin código postal el paquete no sale, aunque haya calle", () => {
    expect(faltaParaEnvio({ address: "Los Notros 195", postalCode: null })).toBe(true);
  });
});

describe("cambios", () => {
  it("sólo devuelve lo que cambió, para que la auditoría se pueda leer", () => {
    const antes: Record<string, string | null> = { address: "Los Notros 195", postalCode: null, phone: "2944158559" };
    const despues: Record<string, string | null> = { address: "Los Notros 195", postalCode: "8370", phone: "2944158559" };
    expect(cambios(antes, despues)).toEqual({ postalCode: "8370" });
  });
});
