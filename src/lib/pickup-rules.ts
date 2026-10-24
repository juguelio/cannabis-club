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
  dayLimitG: number;
  dayUsedG: number;
  stockG: number;
};

export type PickupRuleError = {
  ok: false;
  code: "MEMBER_INACTIVE" | "REPROCANN" | "INVALID_AMOUNT" | "MONTHLY_LIMIT" | "DAILY_LIMIT" | "NO_STOCK";
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

  const disponibleDia = round2(input.dayLimitG - input.dayUsedG);
  if (input.grams > disponibleDia) {
    return {
      ok: false,
      code: "DAILY_LIMIT",
      message: `El tope diario es ${fmt(input.dayLimitG)} y ya retiraste ${fmt(input.dayUsedG)} hoy.`,
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

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const fmt = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;
