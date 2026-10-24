/**
 * Ciclo de vida del lote (funciones puras, testeadas).
 * La cosecha (húmedo → COSECHA, seco → DISPONIBLE) tiene su propio flujo porque acredita stock;
 * acá se deciden los pasos manuales: avanzar el cultivo, curar, agotar, reabrir y destruir.
 */
export const STAGES = ["PROPAGACION", "VEGETATIVO", "FLORACION", "COSECHA", "CURADO", "DISPONIBLE", "AGOTADO", "DESTRUIDO"] as const;
export type Stage = (typeof STAGES)[number];

const MANUAL_NEXT: Record<Stage, Stage[]> = {
  PROPAGACION: ["VEGETATIVO", "DESTRUIDO"],
  VEGETATIVO: ["FLORACION", "DESTRUIDO"],
  FLORACION: ["DESTRUIDO"], // de floración se sale cosechando (peso húmedo)
  COSECHA: ["CURADO", "DESTRUIDO"],
  CURADO: ["DESTRUIDO"], // de curado se sale registrando el peso seco
  DISPONIBLE: ["AGOTADO", "DESTRUIDO"],
  AGOTADO: ["DISPONIBLE", "DESTRUIDO"],
  DESTRUIDO: [],
};

export type StageDecision =
  | { ok: true; destroyRemainderG: number }
  | { ok: false; code: string; message: string };

export function nextStages(stage: Stage): Stage[] {
  return MANUAL_NEXT[stage] ?? [];
}

export function evaluateStageChange(input: { from: Stage; to: Stage; balanceG: number; reason?: string | null }): StageDecision {
  const { from, to, balanceG } = input;
  const reason = input.reason?.trim() ?? "";
  if (from === to) return { ok: false, code: "SAME_STAGE", message: "El lote ya está en esa etapa." };
  if (!MANUAL_NEXT[from]?.includes(to)) {
    const hint =
      from === "FLORACION" ? " Para pasar a cosecha, registrá el peso húmedo." :
      from === "CURADO" || from === "COSECHA" ? " Para habilitarlo, registrá el peso seco." : "";
    return { ok: false, code: "INVALID_TRANSITION", message: `No se puede pasar de ${from} a ${to}.${hint}` };
  }
  if (to === "AGOTADO" && balanceG > 0.0001)
    return { ok: false, code: "HAS_STOCK", message: `El lote todavía tiene ${balanceG} g. Para darlo por agotado el saldo debe ser 0.` };
  if (to === "DISPONIBLE" && balanceG <= 0)
    return { ok: false, code: "NO_STOCK", message: "El lote no tiene saldo: no se puede reabrir para entregas." };
  if (to === "DESTRUIDO" && reason.length < 5)
    return { ok: false, code: "REASON_REQUIRED", message: "Para destruir un lote hace falta un motivo (queda en el libro de destrucciones)." };
  return { ok: true, destroyRemainderG: to === "DESTRUIDO" ? Math.max(0, Math.round(balanceG * 100) / 100) : 0 };
}
