/**
 * Reglas de entrega. Derivadas del REA (docs/REA-clubes-europeos.md):
 * el club configura los topes; acá solo se calcula y se decide.
 * Funciones puras: son las que se testean.
 */

export type LimitConfig = {
  limitePorPedidoG: number;
  limiteMensualG: number;
  limiteMenorG: number;
  edadMinima: number;
  edadLimiteMenor: number;
  thcMaxMenor: number | null;
  requiereReprocann: boolean;
};

export type MemberForCheck = {
  status: string;
  /// Nulo mientras el socio no declaró su fecha de nacimiento (legajo importado sin validar).
  birthDate: Date | string | null;
  reprocannStatus: string;
  reprocannExpiresAt: Date | string | null;
  monthlyForecastG?: number | null;
};

export type Usage = { dayGrams: number; monthGrams: number };

export type Decision = {
  ok: boolean;
  code:
    | "OK"
    | "MEMBER_NOT_ACTIVE"
    | "UNDERAGE"
    | "BIRTH_MISSING"
    | "REPROCANN_MISSING"
    | "REPROCANN_EXPIRED"
    | "REPROCANN_INCOMPLETE"
    | "INVALID_AMOUNT"
    | "THC_LIMIT"
    | "THC_UNKNOWN"
    | "ORDER_LIMIT"
    | "MONTHLY_LIMIT";
  message: string;
  snapshot: {
    checkedAt: string;
    ageYears: number | null;
    grams: number;
    thcPct: number | null;
    usageBefore: Usage;
    usageAfter: Usage;
    limitsApplied: {
      perOrderG: number;
      monthlyG: number;
      thcMaxPct: number | null;
      sellsForMinor: boolean;
    };
    reprocann: { status: string; expiresAt: string | null };
    forecastG: number | null;
  };
};

const toDate = (v: Date | string) => (typeof v === "string" ? new Date(v) : v);

export function ageYears(birthDate: Date | string, at: Date | string): number {
  const b = toDate(birthDate);
  const a = toDate(at);
  let age = a.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday =
    a.getUTCMonth() < b.getUTCMonth() ||
    (a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function evaluateDispensation(input: {
  member: MemberForCheck;
  usage: Usage;
  config: LimitConfig;
  grams: number;
  thcPct?: number | null;
  at?: Date;
}): Decision {
  const { member, usage, config } = input;
  const at = input.at ?? new Date();
  // Sin fecha de nacimiento no se puede saber si es menor: se rechaza, no se asume adulto.
  const age = member.birthDate ? ageYears(member.birthDate, at) : null;
  const isMinor = age === null ? false : age < config.edadLimiteMenor;
  const monthlyLimit = isMinor ? Math.min(config.limiteMenorG, config.limiteMensualG) : config.limiteMensualG;
  const dailyLimit = Math.min(config.limitePorPedidoG, monthlyLimit);
  const thcMax = isMinor ? config.thcMaxMenor : null;
  const grams = Number(input.grams ?? 0);
  const thcPct = input.thcPct == null ? null : Number(input.thcPct);
  const usageBefore = { dayGrams: Number(usage.dayGrams ?? 0), monthGrams: Number(usage.monthGrams ?? 0) };
  const usageAfter = { dayGrams: usageBefore.dayGrams + grams, monthGrams: usageBefore.monthGrams + grams };

  const snapshot = {
    checkedAt: at.toISOString(),
    ageYears: age,
    grams,
    thcPct,
    usageBefore,
    usageAfter,
    limitsApplied: { perOrderG: dailyLimit, monthlyG: monthlyLimit, thcMaxPct: thcMax, sellsForMinor: isMinor },
    reprocann: {
      status: member.reprocannStatus,
      expiresAt: member.reprocannExpiresAt ? toDate(member.reprocannExpiresAt).toISOString().slice(0, 10) : null,
    },
    forecastG: member.monthlyForecastG == null ? null : Number(member.monthlyForecastG),
  };

  const deny = (code: Decision["code"], message: string): Decision => ({ ok: false, code, message, snapshot });

  if (!(grams > 0)) return deny("INVALID_AMOUNT", "La cantidad debe ser mayor a 0 g.");
  if (member.status !== "ACTIVO")
    return deny("MEMBER_NOT_ACTIVE", `El socio está en estado ${member.status} y no puede retirar.`);
  if (age === null)
    return deny("BIRTH_MISSING", "Falta la fecha de nacimiento del socio: no se puede verificar la edad.");
  if (age < config.edadMinima) return deny("UNDERAGE", `El socio tiene ${age} años; el mínimo es ${config.edadMinima}.`);

  if (config.requiereReprocann) {
    const expires = member.reprocannExpiresAt ? toDate(member.reprocannExpiresAt) : null;
    if (member.reprocannStatus !== "VIGENTE")
      return deny("REPROCANN_MISSING", `REPROCANN en estado ${member.reprocannStatus}: no habilita entrega.`);
    if (!expires)
      return deny(
        "REPROCANN_INCOMPLETE",
        "El REPROCANN figura vigente pero no tiene fecha de vencimiento cargada: falta completar el legajo.",
      );
    if (expires.getTime() < at.getTime())
      return deny("REPROCANN_EXPIRED", `REPROCANN vencido el ${expires.toISOString().slice(0, 10)}.`);
  }

  // Ausencia de dato no es aprobación: si hay un máximo aplicable y el lote no declara THC,
  // el control queda pendiente y no se entrega (R03 del REA de operación).
  if (thcMax != null && thcPct == null)
    return deny(
      "THC_UNKNOWN",
      `El lote no tiene THC cargado y para menores de ${config.edadLimiteMenor} el máximo es ${thcMax}%. Cargá el análisis del lote.`,
    );
  if (thcMax != null && thcPct != null && thcPct > thcMax)
    return deny("THC_LIMIT", `El lote tiene ${thcPct}% THC; para menores de ${config.edadLimiteMenor} el máximo es ${thcMax}%.`);
  // El tope del club es por pedido, no por día (lo pidió el club: dos envíos el mismo día son
  // legítimos, incluso para la misma persona con dos REPROCANN). Se mide esta entrega sola.
  if (grams > dailyLimit + 1e-9)
    return deny("ORDER_LIMIT", `Esta entrega lleva ${grams} g y el tope por pedido es ${dailyLimit} g.`);
  if (usageAfter.monthGrams > monthlyLimit + 1e-9)
    return deny("MONTHLY_LIMIT", `Supera el tope mensual (${monthlyLimit} g): ya retiró ${usageBefore.monthGrams} g este mes.`);

  return { ok: true, code: "OK", message: "Entrega habilitada.", snapshot };
}

/** Signo de cada tipo de movimiento en el saldo del lote. */
export const MOVEMENT_SIGN: Record<string, 1 | -1> = {
  INGRESO: 1,
  AJUSTE_POSITIVO: 1,
  DISPENSACION_REVERSA: 1,
  AJUSTE_NEGATIVO: -1,
  DISPENSACION: -1,
  DESTRUCCION: -1,
  TRANSFERENCIA: -1,
};

export function balanceFromMovements(rows: { type: string; grams: unknown }[]): number {
  const total = rows.reduce((acc, r) => acc + MOVEMENT_SIGN[r.type] * Number(r.grams), 0);
  return Math.round(total * 100) / 100;
}
