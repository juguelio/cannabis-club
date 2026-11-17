/**
 * El tablero de pedidos del club: una sola vista de trabajo.
 *
 * Hoy el club sigue un pedido en tres pantallas (`/aportes` para el comprobante, `/dispensario` para la
 * reserva y `/traslados` para el envío). El pedido, en cambio, es uno solo y avanza por estados. Esto lo
 * deriva de lo que ya está guardado, sin migración y sin duplicar datos: la columna es una función del
 * estado del pedido, del último comprobante y de si ya salió a despacho.
 */

import type { EsperadoPedido } from "./comprobante-rules";

export type ColumnaTablero = "FALTA_PAGO" | "A_REVISAR" | "A_PREPARAR" | "LISTO" | "ENTREGADO";

export const COLUMNAS: { key: ColumnaTablero; titulo: string; ayuda: string }[] = [
  { key: "FALTA_PAGO", titulo: "Falta pago", ayuda: "Sin comprobante, o el último fue rechazado." },
  { key: "A_REVISAR", titulo: "A revisar", ayuda: "El socio subió el comprobante: hay que mirarlo." },
  { key: "A_PREPARAR", titulo: "A preparar", ayuda: "Pago aprobado: hay que armarlo." },
  { key: "LISTO", titulo: "Listo o en camino", ayuda: "Para retirar en el club o en poder del transportista." },
  { key: "ENTREGADO", titulo: "Entregados hoy", ayuda: "Cerrados en el día." },
];

export type EntradaColumna = {
  status: string;
  /** Estado del último comprobante: `null` si no subió ninguno. */
  pago: "PENDIENTE" | "EN_REVISION" | "APROBADO" | "RECHAZADO";
  /** Ya se despachó (envío) o se dispensó (retiro). */
  salio: boolean;
  /** Estado del traslado, si el pedido es un envío. */
  traslado: "PREPARACION" | "DESPACHADO" | "ENTREGADO" | "CANCELADO" | null;
  /** ¿Se cerró hoy? Sólo aplica a los ya cumplidos. */
  cerradoHoy: boolean;
};

/**
 * En qué columna cae un pedido.
 *
 * El orden importa: un pedido cancelado o vencido no se trabaja y no aparece en ninguna columna de
 * trabajo; uno ya cerrado va a «Entregados hoy» sólo si cerró hoy (si no, es historial y no tablero).
 */
export function columnaDelPedido(p: EntradaColumna): ColumnaTablero | null {
  if (p.status === "CANCELADA" || p.status === "VENCIDA") return null;

  if (p.status === "RETIRADA") return p.cerradoHoy ? "ENTREGADO" : null;
  if (p.traslado === "ENTREGADO") return p.cerradoHoy ? "ENTREGADO" : null;

  if (p.pago === "PENDIENTE" || p.pago === "RECHAZADO") return "FALTA_PAGO";
  if (p.pago === "EN_REVISION") return "A_REVISAR";

  // Pago aprobado: si ya salió (despachado) está listo; si no, hay que prepararlo.
  if (p.traslado === "DESPACHADO") return "LISTO";
  if (p.salio) return "LISTO";
  return "A_PREPARAR";
}

export type PedidoTablero = {
  id: string;
  columna: ColumnaTablero;
  mode: "RETIRO" | "ENVIO";
  grams: number;
  status: string;
  createdAt: string;
  cuando: string | null;
  member: { id: string; nombre: string; legajo: number; reprocann: string; venceReprocann: string | null };
  items: { nombre: string; gramos: number }[];
  /** Último comprobante, si hay. */
  comprobante: { id: string; estado: string; monto: number | null; createdAt: string; motivo: string | null } | null;
  /** Lo que el club esperaba cobrar (aporte + envío) y su desglose, para comparar con lo declarado. */
  esperado: EsperadoPedido;
  direccion: string | null;
  zona: string | null;
};

/** Lo que hay que preparar hoy, sumado por variedad. */
export type ParaPreparar = { nombre: string; gramos: number; pedidos: number };
