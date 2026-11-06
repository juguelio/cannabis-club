/**
 * Cómo se nombra un pedido en el portal.
 *
 * El enum `PickupStatus` tiene un solo estado «cumplido» (`RETIRADA`) que nació para el retiro en el
 * club. Cuando el pedido es un envío, ese mismo estado significa **despachado**, no entregado: el que
 * confirma la entrega es el transportista, y la app no recibe esa señal. Llamarlo «entregado» sería
 * afirmar algo que no sabemos.
 */
export type ModoPedido = "RETIRO" | "ENVIO";

export type EtiquetaPedido = {
  label: string;
  tone: "brand" | "ok" | "warn" | "mute";
  /** Aclaración que va debajo del estado. `null` cuando el estado se explica solo. */
  nota: string | null;
};

export function estadoPedido(status: string, mode?: ModoPedido | null): EtiquetaPedido {
  const envio = mode === "ENVIO";
  switch (status) {
    case "SOLICITADA":
      return {
        label: envio ? "Pedido hecho" : "Reservado",
        tone: "brand",
        nota: envio ? "El club lo prepara para despachar." : "El club lo va a confirmar.",
      };
    case "CONFIRMADA":
      return {
        label: "Confirmado por el club",
        tone: "ok",
        nota: envio ? "Sale en el próximo despacho." : "Te esperamos en el club.",
      };
    case "RETIRADA":
      return envio
        ? { label: "Despachado", tone: "ok", nota: "Salió del club. La entrega la confirma el transportista." }
        : { label: "Retirado", tone: "mute", nota: null };
    case "VENCIDA":
      return { label: envio ? "Venció sin despachar" : "Venció sin retirar", tone: "warn", nota: null };
    case "CANCELADA":
      return { label: "Cancelado", tone: "mute", nota: null };
    default:
      return { label: status, tone: "mute", nota: null };
  }
}

/** Un pedido está activo mientras el club todavía tiene algo que hacer con él. */
export const esActivo = (status: string) => status === "SOLICITADA" || status === "CONFIRMADA";

/**
 * Un pedido sin comprobante no está cerrado, aunque exista.
 *
 * El pedido se crea cuando el socio confirma la cuenta, pero la transferencia se prueba con el
 * comprobante. Mientras no haya uno recibido, el club no tiene cómo rendir ese aporte: se muestra
 * como pendiente para que nadie lo prepare ni lo entregue por error.
 */
export const faltaComprobante = (pago?: string | null) => pago !== "EN_REVISION" && pago !== "APROBADO";

/** Sólo se le pide comprobante a un pedido que sigue abierto. */
export const esperaComprobante = (status: string, pago?: string | null) => esActivo(status) && faltaComprobante(pago);
