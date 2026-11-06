/**
 * Reglas del comprobante en la confirmación de un pedido.
 *
 * La regla general es dura: sin comprobante no se confirma, porque el club estaría dando por pagado
 * un aporte que no puede rendir. La excepción existe —a veces la transferencia ya está acreditada y el
 * socio no subió nada— pero tiene que ser de un ADMIN, con motivo escrito y auditoría. Aflojar la
 * regla para todos sería volver al problema; esconder la excepción empuja a que se salteen el sistema.
 */
export const MOTIVO_MINIMO = 10;

export const puedeConfirmarSinComprobante = (role: string | null | undefined, motivo: string | null | undefined) =>
  role === "ADMIN" && (motivo ?? "").trim().length >= MOTIVO_MINIMO;
