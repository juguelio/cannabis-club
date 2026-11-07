/**
 * Cuándo se da por caído un pedido.
 *
 * Un pedido sin comprobante no está pagado, y mientras exista **reserva gramos y ocupa un turno**:
 * el socio que sí quiere comprar se encuentra el horario tomado por alguien que nunca transfirió. El
 * club necesita una salida automática y explícita, no que alguien se acuerde de revisar.
 *
 * Dos relojes distintos, porque son dos problemas distintos:
 *
 * - **Sin comprobante**: 48 h desde que hizo el pedido. Es el que bloquea stock y turno sin motivo.
 * - **Con comprobante y sin retirar**: 7 días. Ahí el club ya trabajó y el socio pagó; el plazo es más
 *   largo, y un pedido cargado en un traslado no vence por calendario.
 *
 * La regla es pura para poder probarla: la base la aplica `expireStale`.
 */
export const HORAS_SIN_COMPROBANTE = 48;
export const DIAS_SIN_RETIRAR = 7;

export type EstadoParaVencer = {
  status: string;
  /** Estado del último comprobante; `PENDIENTE` cuando no subió ninguno. */
  pago: "PENDIENTE" | "EN_REVISION" | "APROBADO" | "RECHAZADO";
  /** Minutos desde que se creó el pedido. */
  minutos: number;
  /** Ya está cargado en un traslado: no vence por calendario. */
  enTraslado: boolean;
};

export type Vencimiento = { vence: true; motivo: string } | { vence: false };

const abierto = (status: string) => status === "SOLICITADA" || status === "CONFIRMADA";

/**
 * Sin comprobante no hay pago. Sólo aplica al que nunca subió uno o cuyo último fue rechazado: con un
 * comprobante en revisión el pedido está esperando al club, no al socio, y no se vence.
 */
export function vencimiento(p: EstadoParaVencer): Vencimiento {
  if (!abierto(p.status)) return { vence: false };
  if (p.enTraslado) return { vence: false };

  const sinComprobante = p.pago === "PENDIENTE" || p.pago === "RECHAZADO";
  if (sinComprobante && p.minutos >= HORAS_SIN_COMPROBANTE * 60) {
    return {
      vence: true,
      motivo: `Venció sin comprobante: pasaron ${HORAS_SIN_COMPROBANTE} h y no subió la transferencia`,
    };
  }

  if (p.minutos >= DIAS_SIN_RETIRAR * 24 * 60) {
    return { vence: true, motivo: `Venció sin retirarse: pasaron ${DIAS_SIN_RETIRAR} días` };
  }

  return { vence: false };
}
