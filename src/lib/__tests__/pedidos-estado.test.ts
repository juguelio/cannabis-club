import { describe, expect, it } from "vitest";
import { esActivo, esperaComprobante, estadoPedido, faltaComprobante } from "../pedidos-estado";

describe("estadoPedido", () => {
  it("un envío RETIRADA se llama «Despachado», nunca «entregado»: la entrega no la sabemos", () => {
    const e = estadoPedido("RETIRADA", "ENVIO");
    expect(e.label).toBe("Despachado");
    expect(e.label.toLowerCase()).not.toContain("entregado");
    expect(e.nota).toContain("transportista");
  });

  it("un retiro RETIRADA se llama «Retirado»", () => {
    expect(estadoPedido("RETIRADA", "RETIRO").label).toBe("Retirado");
  });

  it("el mismo estado se nombra distinto según la modalidad", () => {
    expect(estadoPedido("SOLICITADA", "RETIRO").label).toBe("Reservado");
    expect(estadoPedido("SOLICITADA", "ENVIO").label).toBe("Pedido hecho");
    expect(estadoPedido("VENCIDA", "RETIRO").label).toContain("retirar");
    expect(estadoPedido("VENCIDA", "ENVIO").label).toContain("despachar");
  });

  it("un estado desconocido se muestra crudo, no se inventa una traducción", () => {
    expect(estadoPedido("RARO", "RETIRO").label).toBe("RARO");
  });

  it("sin modalidad asume retiro, que es el modo histórico", () => {
    expect(estadoPedido("RETIRADA", null).label).toBe("Retirado");
  });
});

describe("esActivo", () => {
  it("sólo SOLICITADA y CONFIRMADA están activos", () => {
    expect(esActivo("SOLICITADA")).toBe(true);
    expect(esActivo("CONFIRMADA")).toBe(true);
    expect(esActivo("RETIRADA")).toBe(false);
    expect(esActivo("VENCIDA")).toBe(false);
    expect(esActivo("CANCELADA")).toBe(false);
  });
});

describe("comprobante", () => {
  it("un pedido sin comprobante no está cerrado", () => {
    expect(faltaComprobante("PENDIENTE")).toBe(true);
    expect(faltaComprobante(null)).toBe(true);
    expect(faltaComprobante(undefined)).toBe(true);
  });

  it("en revisión o aprobado ya no falta", () => {
    expect(faltaComprobante("EN_REVISION")).toBe(false);
    expect(faltaComprobante("APROBADO")).toBe(false);
  });

  it("sólo se le pide a un pedido abierto: uno cancelado o retirado no debe nada", () => {
    expect(esperaComprobante("SOLICITADA", "PENDIENTE")).toBe(true);
    expect(esperaComprobante("CONFIRMADA", null)).toBe(true);
    expect(esperaComprobante("CANCELADA", "PENDIENTE")).toBe(false);
    expect(esperaComprobante("RETIRADA", null)).toBe(false);
  });
});
