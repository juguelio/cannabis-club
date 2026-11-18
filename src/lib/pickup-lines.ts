/**
 * Atender una reserva del portal, variedad por variedad.
 *
 * El club eligió el combo (`PickupItem`), no sólo el total: el mostrador imputa cada genética
 * reservada contra un lote de esa genética y la cantidad viene puesta. Estas funciones son puras
 * (sin Prisma) para poder testear el número que después se firma en el libro.
 */

export type PickupItemLite = { id: string; strainId: string; strainName: string; grams: number };
export type BatchLite = { id: string; code: string; strainId: string; balanceG: number; thcPct: number | null };

/** Una fila del mostrador: qué ítem reservado se imputa, con qué lote y cuántos gramos. */
export type PickupLine = {
  pickupItemId: string;
  strainId: string;
  strainName: string;
  reservedG: number;
  batchId: string;
  grams: string;
};

export type LimitsForLines = { perOrderG: number; monthlyG: number; usage: { dayGrams: number; monthGrams: number }; thcMaxPct: number | null };

const EPS = 1e-9;
export const round2 = (v: number) => Math.round(v * 100) / 100;

/** Gramos escritos por el operador ("5", "5,5", ""): número o 0. */
export function gramsOf(text: string): number {
  const n = Number(String(text ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Una fila por variedad reservada, con la cantidad reservada puesta y el lote sin elegir. */
export function draftLines(items: PickupItemLite[]): PickupLine[] {
  return items.map((i) => ({
    pickupItemId: i.id,
    strainId: i.strainId,
    strainName: i.strainName,
    reservedG: round2(Number(i.grams)),
    batchId: "",
    grams: String(round2(Number(i.grams))),
  }));
}

export function batchesForStrain(batches: BatchLite[], strainId: string): BatchLite[] {
  return batches.filter((b) => b.strainId === strainId && b.balanceG > 0);
}

export type LineProblem = { tone: "bad" | "warn"; text: string };

/**
 * Qué le falta a una fila para poder entregarse. `bad` bloquea la confirmación; `warn` se registra.
 * El servidor vuelve a validar todo: esto es para que el operador vea el motivo.
 */
export function lineProblems(line: PickupLine, batches: BatchLite[], limits: LimitsForLines | null): LineProblem[] {
  const out: LineProblem[] = [];
  const grams = gramsOf(line.grams);
  const batch = batches.find((b) => b.id === line.batchId);

  if (!batch) out.push({ tone: "bad", text: `Elegí el lote de ${line.strainName}.` });
  if (grams <= 0) out.push({ tone: "bad", text: `Poné los gramos de ${line.strainName}.` });

  if (batch) {
    if (batch.strainId !== line.strainId)
      out.push({ tone: "bad", text: `El lote ${batch.code} no es de ${line.strainName}.` });
    if (grams > batch.balanceG + EPS)
      out.push({ tone: "bad", text: `El lote ${batch.code} tiene ${round2(batch.balanceG)} g.` });
    if (limits?.thcMaxPct != null) {
      if (batch.thcPct == null)
        out.push({ tone: "bad", text: `El lote ${batch.code} no tiene THC cargado y hay un máximo de ${limits.thcMaxPct}%.` });
      else if (batch.thcPct > limits.thcMaxPct)
        out.push({ tone: "bad", text: `El lote ${batch.code} tiene ${batch.thcPct}% THC; el máximo es ${limits.thcMaxPct}%.` });
    }
  }

  // Entregar distinto de lo reservado está permitido: se registra el apartamiento.
  if (grams > 0 && batch && Math.abs(grams - line.reservedG) > 0.001)
    out.push({
      tone: "warn",
      text:
        grams > line.reservedG
          ? `Entregás ${round2(grams - line.reservedG)} g más de ${line.strainName} de lo reservado.`
          : `Entregás ${round2(line.reservedG - grams)} g menos de ${line.strainName} de lo reservado.`,
    });

  return out;
}

/** Problemas del conjunto: lotes repetidos y topes del socio medidos sobre la suma de las filas. */
export function setProblems(lines: PickupLine[], limits: LimitsForLines | null): LineProblem[] {
  const out: LineProblem[] = [];
  const used = new Map<string, string>();
  for (const l of lines) {
    if (!l.batchId || gramsOf(l.grams) <= 0) continue;
    const prev = used.get(l.batchId);
    if (prev) out.push({ tone: "bad", text: `El lote elegido se repite: ${prev} y ${l.strainName}.` });
    else used.set(l.batchId, l.strainName);
  }
  const total = totalGrams(lines);
  if (limits && total > 0) {
    const monthAfter = round2(limits.usage.monthGrams + total);
    if (total > limits.perOrderG + EPS)
      out.push({ tone: "bad", text: `La entrega suma ${round2(total)} g: pasa el tope por pedido de ${limits.perOrderG} g.` });
    if (monthAfter > limits.monthlyG + EPS)
      out.push({ tone: "bad", text: `La entrega suma ${round2(total)} g: pasa el tope mensual de ${limits.monthlyG} g.` });
  }
  return out;
}

export function totalGrams(lines: PickupLine[]): number {
  return round2(lines.reduce((a, l) => a + gramsOf(l.grams), 0));
}

export type Coverage = {
  reservedG: number;
  assignedG: number;
  differenceG: number;
  /** Todas las variedades reservadas quedaron imputadas con un lote. */
  complete: boolean;
  pending: string[];
};

/** Cuánto de la reserva cubre el conjunto de filas. La reserva se cierra sólo si `complete`. */
export function pickupCoverage(items: PickupItemLite[], lines: PickupLine[]): Coverage {
  const reservedG = round2(items.reduce((a, i) => a + Number(i.grams), 0));
  const pending: string[] = [];
  let covered = 0;
  for (const item of items) {
    const line = lines.find((l) => l.pickupItemId === item.id);
    const ok = Boolean(line && line.batchId && gramsOf(line.grams) > 0);
    if (ok) covered += 1;
    else pending.push(item.strainName);
  }
  const assignedG = totalGrams(lines);
  return {
    reservedG,
    assignedG,
    differenceG: round2(assignedG - reservedG),
    complete: items.length > 0 && covered === items.length,
    pending,
  };
}
