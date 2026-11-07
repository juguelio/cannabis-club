import { describe, expect, it } from "vitest";
import { DIAS_SIN_RETIRAR, HORAS_SIN_COMPROBANTE, vencimiento } from "../pedido-vencimiento";

const base = { status: "SOLICITADA", pago: "PENDIENTE" as const, minutos: 0, enTraslado: false };
const horas = (h: number) => h * 60;

describe("vencimiento de pedidos", () => {
  it("recién hecho no vence", () => {
    expect(vencimiento(base).vence).toBe(false);
  });

  it("sin comprobante vence a las 48 h", () => {
    const r = vencimiento({ ...base, minutos: horas(HORAS_SIN_COMPROBANTE) });
    expect(r.vence).toBe(true);
    if (r.vence) expect(r.motivo).toContain("sin comprobante");
  });

  it("una hora antes del plazo todavía no", () => {
    expect(vencimiento({ ...base, minutos: horas(HORAS_SIN_COMPROBANTE) - 60 }).vence).toBe(false);
  });

  it("con el comprobante rechazado también corre el reloj: el socio tiene que subir otro", () => {
    expect(vencimiento({ ...base, pago: "RECHAZADO", minutos: horas(HORAS_SIN_COMPROBANTE) }).vence).toBe(true);
  });

  it("con el comprobante en revisión NO vence: está esperando al club, no al socio", () => {
    expect(vencimiento({ ...base, pago: "EN_REVISION", minutos: horas(72) }).vence).toBe(false);
  });

  it("aprobado y sin retirar aguanta los días largos, no las 48 h", () => {
    expect(vencimiento({ ...base, status: "CONFIRMADA", pago: "APROBADO", minutos: horas(72) }).vence).toBe(false);
    const r = vencimiento({ ...base, status: "CONFIRMADA", pago: "APROBADO", minutos: DIAS_SIN_RETIRAR * 24 * 60 });
    expect(r.vence).toBe(true);
    if (r.vence) expect(r.motivo).toContain("sin retirarse");
  });

  it("un pedido cargado en un traslado no vence por calendario", () => {
    expect(vencimiento({ ...base, status: "CONFIRMADA", pago: "APROBADO", minutos: horas(24 * 30), enTraslado: true }).vence).toBe(false);
  });

  it("lo ya cerrado no se vuelve a vencer", () => {
    expect(vencimiento({ ...base, status: "RETIRADA", pago: "APROBADO", minutos: horas(500) }).vence).toBe(false);
    expect(vencimiento({ ...base, status: "CANCELADA", minutos: horas(500) }).vence).toBe(false);
    expect(vencimiento({ ...base, status: "VENCIDA", minutos: horas(500) }).vence).toBe(false);
  });
});
