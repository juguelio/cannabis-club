import { describe, expect, it } from "vitest";
import {
  analizarMonto,
  cobroConfigurado,
  estadoDePago,
  leerCobro,
  normalizarCobro,
  puedeSubirComprobante,
} from "@/lib/comprobante-rules";

/**
 * El comprobante es la prueba del aporte: sin pasarela de pago, el archivo y la decisión del club son
 * todo lo que hay. Estas reglas definen cuándo se acepta, cuándo se rechaza una subida y cómo se lee
 * el estado de un pedido.
 */

const revisado = (status: "EN_REVISION" | "APROBADO" | "RECHAZADO", createdAt: string) => ({ status, createdAt });

describe("estadoDePago", () => {
  it("sin comprobantes el pedido está pendiente", () => {
    expect(estadoDePago([])).toBe("PENDIENTE");
  });

  it("manda el último comprobante, no el primero", () => {
    expect(
      estadoDePago([
        revisado("RECHAZADO", "2026-11-01T10:00:00Z"),
        revisado("APROBADO", "2026-11-02T10:00:00Z"),
      ]),
    ).toBe("APROBADO");
  });

  it("un rechazo posterior vuelve el pedido a rechazado", () => {
    expect(
      estadoDePago([
        revisado("EN_REVISION", "2026-11-02T12:00:00Z"),
        revisado("RECHAZADO", "2026-11-02T13:00:00Z"),
      ]),
    ).toBe("RECHAZADO");
  });
});

describe("puedeSubirComprobante", () => {
  const con = (pickupStatus: "SOLICITADA" | "CONFIRMADA" | "RETIRADA" | "VENCIDA" | "CANCELADA", estadoPago: "PENDIENTE" | "EN_REVISION" | "APROBADO" | "RECHAZADO") =>
    puedeSubirComprobante({ pickupStatus, estadoPago });

  it("un pedido nuevo sin comprobante puede subir", () => {
    expect(con("SOLICITADA", "PENDIENTE").ok).toBe(true);
  });

  it("uno rechazado puede corregir y volver a subir", () => {
    expect(con("SOLICITADA", "RECHAZADO").ok).toBe(true);
  });

  it("no se apilan comprobantes: con uno en revisión se espera", () => {
    const r = con("SOLICITADA", "EN_REVISION");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("COMPROBANTE_EN_REVISION");
  });

  it("lo aprobado no se reescribe", () => {
    const r = con("CONFIRMADA", "APROBADO");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("PAGO_YA_APROBADO");
  });

  it("un pedido cerrado no acepta comprobantes", () => {
    for (const estado of ["RETIRADA", "VENCIDA", "CANCELADA"] as const) {
      const r = con(estado, "PENDIENTE");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codigo).toBe("PEDIDO_CERRADO");
    }
  });
});

describe("analizarMonto", () => {
  it("dice cuánto falta cuando transfirió de menos", () => {
    expect(analizarMonto({ monto: 100000, esperado: 130000 })).toEqual({ esperado: 130000, diferencia: -30000, cubreTotal: false });
  });

  it("cubre justo el aporte", () => {
    expect(analizarMonto({ monto: 130000, esperado: 130000 }).cubreTotal).toBe(true);
  });

  it("un transferencia de más también cubre", () => {
    expect(analizarMonto({ monto: 140000, esperado: 130000 })).toMatchObject({ diferencia: 10000, cubreTotal: true });
  });

  it("centavos de redondeo no son deuda", () => {
    expect(analizarMonto({ monto: 129999.6, esperado: 130000 }).cubreTotal).toBe(true);
  });

  it("sin monto declarado no se afirma nada", () => {
    expect(analizarMonto({ monto: null, esperado: 130000 })).toEqual({ esperado: 130000, diferencia: null, cubreTotal: null });
  });

  it("sin aporte estimado no hay contra qué comparar", () => {
    expect(analizarMonto({ monto: 50000, esperado: null })).toEqual({ esperado: null, diferencia: null, cubreTotal: null });
  });
});

describe("datos de cobro del club", () => {
  it("acepta alias y CBU de 22 dígitos", () => {
    const c = leerCobro({ alias: "club.ejemplo", cbu: "2850590940090418135201", titular: "Club El Bosque", banco: "Macro" });
    expect(c).toEqual({ alias: "club.ejemplo", cbu: "2850590940090418135201", titular: "Club El Bosque", banco: "Macro", nota: null });
    expect(cobroConfigurado(c)).toBe(true);
  });

  it("un CBU con guiones se guarda limpio y uno corto se descarta", () => {
    expect(leerCobro({ cbu: "2850-5909-4009-0418-1352-01" }).cbu).toBe("2850590940090418135201");
    expect(leerCobro({ cbu: "123" }).cbu).toBeNull();
  });

  it("sin alias ni CBU el club no puede mostrar a dónde transferir", () => {
    expect(cobroConfigurado(leerCobro(null))).toBe(false);
    expect(normalizarCobro({ alias: "  ", cbu: "" })).toBeNull();
  });

  it("normalizar guarda sólo lo que hay", () => {
    expect(normalizarCobro({ alias: " club.ejemplo ", nota: "  Transferí antes de las 18 " })).toEqual({
      alias: "club.ejemplo",
      nota: "Transferí antes de las 18",
    });
  });
});
