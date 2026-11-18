import { describe, expect, it } from "vitest";
import { detalleEntrega, esDespacho, esModoEntrega, esSucursal, MODOS_ENTREGA, tituloEntrega } from "@/lib/entrega";

describe("formas de entrega", () => {
  it("son tres, no dos", () => {
    expect(MODOS_ENTREGA).toEqual(["RETIRO", "ENVIO", "SUCURSAL"]);
  });

  it("domicilio y sucursal salen del club: cuentan como despacho", () => {
    expect(esDespacho("ENVIO")).toBe(true);
    expect(esDespacho("SUCURSAL")).toBe(true);
    expect(esDespacho("RETIRO")).toBe(false);
    expect(esDespacho(null)).toBe(false);
    expect(esDespacho(undefined)).toBe(false);
  });

  it("sólo sucursal es sucursal", () => {
    expect(esSucursal("SUCURSAL")).toBe(true);
    expect(esSucursal("ENVIO")).toBe(false);
    expect(esSucursal("RETIRO")).toBe(false);
  });

  it("cada modo tiene su nombre, y lo desconocido cae en retiro", () => {
    expect(tituloEntrega("RETIRO")).toBe("Retiro en el club");
    expect(tituloEntrega("ENVIO")).toBe("Envío a domicilio");
    expect(tituloEntrega("SUCURSAL")).toBe("Envío a sucursal Andreani");
    expect(tituloEntrega(null)).toBe("Retiro en el club");
  });

  it("sólo la sucursal necesita la aclaración de dónde se retira", () => {
    expect(detalleEntrega("SUCURSAL")).toContain("Andreani");
    expect(detalleEntrega("SUCURSAL")).toContain("DNI");
    expect(detalleEntrega("ENVIO")).toBeNull();
    expect(detalleEntrega("RETIRO")).toBeNull();
  });

  it("reconoce los modos válidos y rechaza el resto", () => {
    expect(esModoEntrega("SUCURSAL")).toBe(true);
    expect(esModoEntrega("ENVIO")).toBe(true);
    expect(esModoEntrega("RETIRO")).toBe(true);
    expect(esModoEntrega("MOTO")).toBe(false);
    expect(esModoEntrega(null)).toBe(false);
  });
});
