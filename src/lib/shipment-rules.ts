/**
 * Reglas puras del traslado (sin Prisma ni `server-only`), para poder testearlas y usarlas en el cliente.
 */

/** Código legible del traslado: TR-AAAAMMDD-NN, con NN secuencial por día. */
export function shipmentCode(date: Date, existingToday: number): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `TR-${y}${m}${d}-${String(existingToday + 1).padStart(2, "0")}`;
}

export type DispatchCheck = { ok: true } | { ok: false; reason: string };

/**
 * ¿Puede salir el traslado? Sin ítems no hay traslado; todo ítem necesita gramos y DDJJ firmada.
 * La liberación del lote, el recall y el stock se revalidan al entregar (los hace el dispensario).
 */
export function canDispatch(items: { grams: number; ddjjSignedAt: Date | string | null }[]): DispatchCheck {
  if (items.length === 0) return { ok: false, reason: "El traslado no tiene pacientes cargados." };
  const sinDdjj = items.filter((i) => !i.ddjjSignedAt).length;
  if (sinDdjj > 0) return { ok: false, reason: sinDdjj === 1 ? "Falta la DDJJ firmada de un paciente." : `Faltan ${sinDdjj} DDJJ firmadas.` };
  const sinGramos = items.filter((i) => Number(i.grams) <= 0).length;
  if (sinGramos > 0) return { ok: false, reason: "Hay ítems sin gramos." };
  return { ok: true };
}

/**
 * Un ítem está entregado sólo si su dispensa existe y **no** fue anulada. Anular una entrega
 * devuelve el traslado a "despachado": el estado no puede decir entregado sobre un asiento anulado.
 */
export function isItemDelivered(item: { dispensationId: string | null; dispensationVoidedAt?: Date | string | null }): boolean {
  return Boolean(item.dispensationId) && !item.dispensationVoidedAt;
}

/** Estado real del traslado según sus ítems (la base guarda el último estado escrito). */
export function resolveShipmentStatus(
  current: string,
  items: { dispensationId: string | null; dispensationVoidedAt?: Date | string | null }[],
): string {
  if (current === "CANCELADO") return "CANCELADO";
  if (items.length === 0) return current;
  if (items.every(isItemDelivered)) return "ENTREGADO";
  if (current === "ENTREGADO") return "DESPACHADO";
  return current;
}

export function totalGrams(items: { grams: unknown }[]): number {
  return Math.round(items.reduce((acc, i) => acc + Number(i.grams), 0) * 100) / 100;
}
