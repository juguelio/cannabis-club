/**
 * Ciclo de vida de la credencial (hallazgo de la revisión de Codex, 25-oct-2026).
 *
 * La clave temporal que se dicta en el mostrador **vence** y **obliga a cambiarla**; cambiar o
 * restablecer la clave sube `tokenVersion`, así que los tokens ya emitidos dejan de valer.
 * Reglas puras, para poder testearlas sin base.
 */

/** Cuánto vale la clave temporal entregada en el mostrador. */
export const TEMP_PASSWORD_HOURS = 72;
/** Mínimo de la clave nueva que elige la persona. */
export const MIN_PASSWORD_LENGTH = 8;

export function tempPasswordExpired(changedAt: Date | string | null | undefined, now = new Date()): boolean {
  if (!changedAt) return false;
  const t = new Date(changedAt).getTime();
  return now.getTime() - t > TEMP_PASSWORD_HOURS * 3_600_000;
}

export type PolicyResult = { ok: true } | { ok: false; message: string };

export function passwordPolicy(next: string, current?: string): PolicyResult {
  const value = next ?? "";
  if (value.trim().length < MIN_PASSWORD_LENGTH) return { ok: false, message: `La clave nueva necesita al menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  if (value.trim() !== value) return { ok: false, message: "La clave no puede empezar ni terminar con espacios." };
  if (current && value === current) return { ok: false, message: "La clave nueva tiene que ser distinta de la temporal." };
  if (/^\d+$/.test(value)) return { ok: false, message: "Una clave sólo de números es fácil de adivinar: agregá letras." };
  return { ok: true };
}
