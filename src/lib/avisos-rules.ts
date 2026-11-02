/**
 * Reglas del aviso de vencimiento del REPROCANN (puras, testeables sin base).
 *
 * El aviso tiene que ser uno por vencimiento, no uno por día: si el cron corre todos los días y
 * escribe cada vez, el socio recibe treinta mails iguales y el club deja de creerle a la cola.
 * El «episodio» es la fecha de vencimiento: cambia cuando el socio renueva, y ahí vuelve a avisar.
 */

/** Días que faltan para el vencimiento, medidos en fecha (no en horas). Negativo = ya venció. */
export function diasHastaVencer(expira: Date | null, hoy: Date): number | null {
  if (!expira) return null;
  const a = Date.UTC(expira.getUTCFullYear(), expira.getUTCMonth(), expira.getUTCDate());
  const b = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  return Math.round((a - b) / 86_400_000);
}

/** Clave del episodio: la fecha de vencimiento en ISO corto. */
export function episodioDeVencimiento(expira: Date): string {
  return `vence:${expira.toISOString().slice(0, 10)}`;
}

/**
 * ¿Entra en la ventana de aviso? Se avisa desde el día en que faltan `umbral` días hasta el
 * vencimiento (día 0). Vencido ya no es «por vencer»: eso lo muestra la cola con otro motivo.
 */
export function enVentanaDeAviso(dias: number | null, umbral: number): boolean {
  if (dias == null) return false;
  return dias >= 0 && dias <= umbral;
}

export function textoAvisoVencimiento(input: { nombre: string; dias: number; club: string }): string {
  const cuando =
    input.dias === 0 ? "vence hoy" : input.dias === 1 ? "vence mañana" : `vence en ${input.dias} días`;
  return [
    `Hola ${input.nombre}: tu REPROCANN ${cuando}.`,
    "",
    `Sin el trámite al día no vas a poder retirar ni recibir tu producción en ${input.club}.`,
    "Si ya lo renovaste, mandanos el comprobante y lo actualizamos en tu legajo.",
    "",
    input.club,
  ].join("\n");
}
