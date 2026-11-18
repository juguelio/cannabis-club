/**
 * Reglas de la reserva de retiro (funciones puras, testeables).
 *
 * La reserva NO es una venta: el socio reserva gramos de la producción del club y paga el
 * aporte de cultivo prorrateado al retirar, en el club. Estas reglas sólo verifican que lo
 * reservado entre en lo que le queda del mes, sin stock negativo ni doble reserva.
 */

export type PickupRulesInput = {
  grams: number;
  memberActive: boolean;
  reprocannOk: boolean;
  /** Tope del mes que le aplica (menores tienen otro). */
  monthLimitG: number;
  /** Ya retirado este mes (entregas vigentes). */
  monthUsedG: number;
  /** Reservado y todavía no retirado (para no reservar dos veces lo mismo). */
  pendingGrams: number;
  perOrderLimitG: number;
  dayUsedG: number;
  stockG: number;
};

export type PickupRuleError = {
  ok: false;
  code: "MEMBER_INACTIVE" | "REPROCANN" | "INVALID_AMOUNT" | "MONTHLY_LIMIT" | "ORDER_LIMIT" | "NO_STOCK";
  message: string;
};

export type PickupRuleOk = {
  ok: true;
  /** Gramos que le quedan del mes después de esta reserva. */
  remainingAfterG: number;
};

export function evaluatePickup(input: PickupRulesInput): PickupRuleOk | PickupRuleError {
  if (!input.memberActive) {
    return { ok: false, code: "MEMBER_INACTIVE", message: "Tu ficha no está activa. Hablá con la secretaría del club." };
  }
  if (!input.reprocannOk) {
    return {
      ok: false,
      code: "REPROCANN",
      message: "Tu REPROCANN no está vigente. Sin eso el club no puede reservarte un retiro.",
    };
  }
  if (!Number.isFinite(input.grams) || input.grams <= 0) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Indicá cuántos gramos querés reservar." };
  }

  const disponibleMes = round2(input.monthLimitG - input.monthUsedG - input.pendingGrams);
  if (input.grams > disponibleMes) {
    return {
      ok: false,
      code: "MONTHLY_LIMIT",
      message: `Te quedan ${fmt(disponibleMes)} de tu tope mensual (${fmt(input.monthLimitG)}).`,
    };
  }

  if (input.grams > input.perOrderLimitG + 1e-9) {
    return {
      ok: false,
      code: "ORDER_LIMIT",
      message: `Cada pedido puede ser de hasta ${fmt(input.perOrderLimitG)}. Si necesitás más, hacé otro pedido: no hay tope diario.`,
    };
  }

  if (input.stockG + 1e-9 < input.grams) {
    return {
      ok: false,
      code: "NO_STOCK",
      message: `El club tiene ${fmt(input.stockG)} disponibles para reservar en este momento.`,
    };
  }

  return { ok: true, remainingAfterG: round2(disponibleMes - input.grams) };
}

/**
 * Envío a domicilio: lo que hay que verificar ANTES de aceptar el pedido.
 *
 * Un envío no ocupa turno (el socio no viene), pero sí tiene dos condiciones propias: viaja a una
 * dirección concreta y por una zona que el club cobra. Y el tope por envío no es un capricho: es
 * cuántas membresías entran en una caja (`maxMembresiasPorEnvio`), para que el despacho sea uno.
 */
export type EnvioZona = { zona: string; precioArs: number; demora: string; transportista?: string };

export type EnvioRulesInput = {
  grams: number;
  direccion: string;
  zona: string;
  zonas: EnvioZona[];
  topeEnvioG: number;
};

export type EnvioRuleError = {
  ok: false;
  code: "ENVIO_SIN_ZONAS" | "ENVIO_SIN_ZONA" | "ENVIO_SIN_DIRECCION" | "ENVIO_TOPE";
  message: string;
};

export type EnvioRuleOk = { ok: true; costoArs: number; demora: string; transportista?: string };

export function evaluateEnvio(input: EnvioRulesInput): EnvioRuleOk | EnvioRuleError {
  if (input.zonas.length === 0) {
    return {
      ok: false,
      code: "ENVIO_SIN_ZONAS",
      message: "El club todavía no cargó las zonas de envío. Elegí retirar en el club.",
    };
  }
  const elegida = input.zonas.find((z) => z.zona === input.zona);
  if (!elegida) {
    return { ok: false, code: "ENVIO_SIN_ZONA", message: "Elegí la zona de envío." };
  }
  // La dirección es lo único que hace que el envío exista: sin calle y número no se despacha.
  if (input.direccion.trim().length < 8) {
    return {
      ok: false,
      code: "ENVIO_SIN_DIRECCION",
      message: "Escribí la dirección completa: calle, número, localidad y código postal.",
    };
  }
  if (input.grams > input.topeEnvioG + 1e-9) {
    return {
      ok: false,
      code: "ENVIO_TOPE",
      message: `Por envío salen hasta ${fmt(input.topeEnvioG)}. Si necesitás más, dividilo en dos pedidos.`,
    };
  }
  return { ok: true, costoArs: elegida.precioArs, demora: elegida.demora, transportista: elegida.transportista };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const fmt = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;
