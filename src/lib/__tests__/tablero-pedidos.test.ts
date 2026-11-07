import { describe, expect, it } from "vitest";
import { columnaDelPedido, type EntradaColumna } from "../tablero-pedidos";

const base: EntradaColumna = {
  status: "SOLICITADA",
  pago: "PENDIENTE",
  salio: false,
  traslado: null,
  cerradoHoy: false,
};

describe("tablero de pedidos: en qué columna cae cada uno", () => {
  it("sin comprobante va a «falta pago»", () => {
    expect(columnaDelPedido(base)).toBe("FALTA_PAGO");
  });

  it("con el comprobante rechazado vuelve a «falta pago»: el socio tiene que subir otro", () => {
    expect(columnaDelPedido({ ...base, pago: "RECHAZADO" })).toBe("FALTA_PAGO");
  });

  it("con el comprobante en revisión va a «a revisar»", () => {
    expect(columnaDelPedido({ ...base, pago: "EN_REVISION" })).toBe("A_REVISAR");
  });

  it("aprobado y sin salir va a «a preparar»", () => {
    expect(columnaDelPedido({ ...base, status: "CONFIRMADA", pago: "APROBADO" })).toBe("A_PREPARAR");
  });

  it("aprobado y ya despachado está «listo o en camino»", () => {
    expect(columnaDelPedido({ ...base, status: "CONFIRMADA", pago: "APROBADO", traslado: "DESPACHADO" })).toBe("LISTO");
  });

  it("un retiro ya dispensado pero sin cerrar está «listo»", () => {
    expect(columnaDelPedido({ ...base, status: "CONFIRMADA", pago: "APROBADO", salio: true })).toBe("LISTO");
  });

  it("un envío entregado hoy va a «entregados hoy»", () => {
    expect(columnaDelPedido({ ...base, status: "RETIRADA", pago: "APROBADO", traslado: "ENTREGADO", cerradoHoy: true })).toBe("ENTREGADO");
  });

  it("lo retirado hoy va a «entregados hoy», y lo retirado antes no está en el tablero", () => {
    expect(columnaDelPedido({ ...base, status: "RETIRADA", pago: "APROBADO", salio: true, cerradoHoy: true })).toBe("ENTREGADO");
    expect(columnaDelPedido({ ...base, status: "RETIRADA", pago: "APROBADO", salio: true, cerradoHoy: false })).toBeNull();
  });

  it("cancelado o vencido no es trabajo de nadie: no aparece", () => {
    expect(columnaDelPedido({ ...base, status: "CANCELADA" })).toBeNull();
    expect(columnaDelPedido({ ...base, status: "VENCIDA" })).toBeNull();
  });

  it("un envío entregado ayer no ensucia «entregados hoy»", () => {
    expect(columnaDelPedido({ ...base, status: "CONFIRMADA", pago: "APROBADO", traslado: "ENTREGADO", cerradoHoy: false })).toBeNull();
  });
});
