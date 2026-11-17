/**
 * Comprobante de pago del aporte.
 *
 * El club no cobra online: el socio transfiere, sube la foto del comprobante y el club lo mira y decide.
 * Estas funciones son las reglas puras —qué se acepta, cuándo se puede volver a subir y cómo se lee el
 * estado— para poder probarlas sin base ni pantalla.
 */

export type EstadoComprobante = "EN_REVISION" | "APROBADO" | "RECHAZADO";
export type EstadoPago = "PENDIENTE" | "EN_REVISION" | "APROBADO" | "RECHAZADO";

export type ComprobanteMin = {
  status: EstadoComprobante;
  createdAt: Date | string;
  motivo?: string | null;
};

export type DatosCobro = {
  alias: string | null;
  cbu: string | null;
  titular: string | null;
  banco: string | null;
  nota: string | null;
};

const limpiar = (v: unknown, max = 120) =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";

/**
 * Lee `Club.cobro` (JSON guardado por el club). Devuelve nulls en vez de fallar: un club sin datos de
 * cobro no puede romper el portal, sólo no puede mostrar a dónde transferir.
 */
export function leerCobro(valor: unknown): DatosCobro {
  const raw = (valor ?? {}) as Record<string, unknown>;
  // Primero se sacan guiones y espacios, después se valida: truncar antes rompía el CBU escrito con guiones.
  const cbu = (typeof raw.cbu === "string" ? raw.cbu : "").replace(/[\s.-]/g, "").slice(0, 22);
  return {
    alias: limpiar(raw.alias, 60) || null,
    cbu: /^\d{22}$/.test(cbu) ? cbu : null,
    titular: limpiar(raw.titular, 80) || null,
    banco: limpiar(raw.banco, 60) || null,
    nota: limpiar(raw.nota, 200) || null,
  };
}

export const cobroConfigurado = (c: DatosCobro) => Boolean(c.alias || c.cbu);

/** `Club.cobro` tal como se guarda: sin vacíos ni CBU inválido. */
export function normalizarCobro(valor: unknown) {
  const c = leerCobro(valor);
  const salida: Record<string, string> = {};
  if (c.alias) salida.alias = c.alias;
  if (c.cbu) salida.cbu = c.cbu;
  if (c.titular) salida.titular = c.titular;
  if (c.banco) salida.banco = c.banco;
  if (c.nota) salida.nota = c.nota;
  return Object.keys(salida).length ? salida : null;
}

/**
 * El estado del pago de un pedido se lee del último comprobante: los rechazados no borran el historial,
 * pero tampoco dejan el pedido como pagado.
 */
export function estadoDePago(comprobantes: ComprobanteMin[]): EstadoPago {
  if (!comprobantes.length) return "PENDIENTE";
  const ultimo = [...comprobantes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
  return ultimo.status;
}

/**
 * ¿Se puede subir (o volver a subir) un comprobante?
 *
 * - Con un comprobante aprobado no: el pedido ya está pago y cambiarlo sería reescribir la prueba.
 * - Con uno en revisión tampoco: primero el club contesta, si no se apilan fotos sin resolver.
 * - Rechazado sí: el socio corrige y sube el bueno.
 * - Pedido cancelado o ya retirado: no.
 */
export function puedeSubirComprobante(params: {
  pickupStatus: "SOLICITADA" | "CONFIRMADA" | "RETIRADA" | "VENCIDA" | "CANCELADA";
  estadoPago: EstadoPago;
}): { ok: true } | { ok: false; codigo: string; mensaje: string } {
  if (params.pickupStatus === "CANCELADA" || params.pickupStatus === "VENCIDA" || params.pickupStatus === "RETIRADA")
    return {
      ok: false,
      codigo: "PEDIDO_CERRADO",
      mensaje: "Ese pedido ya está cerrado: no se le puede agregar un comprobante.",
    };
  if (params.estadoPago === "APROBADO")
    return { ok: false, codigo: "PAGO_YA_APROBADO", mensaje: "El club ya aprobó el comprobante de este pedido." };
  if (params.estadoPago === "EN_REVISION")
    return {
      ok: false,
      codigo: "COMPROBANTE_EN_REVISION",
      mensaje: "Ya hay un comprobante en revisión: esperá la respuesta del club.",
    };
  return { ok: true };
}

/**
 * Compara lo que el socio dice haber transferido con el aporte estimado del pedido.
 * No bloquea: una diferencia de menos es una decisión del club, no un error del sistema.
 */
export function analizarMonto(params: { monto: number | null; esperado: number | null }) {
  const { monto, esperado } = params;
  if (esperado == null) return { esperado: null, diferencia: null, cubreTotal: null as boolean | null };
  if (monto == null) return { esperado, diferencia: null, cubreTotal: null };
  const diferencia = Number((monto - esperado).toFixed(2));
  // Centavos de redondeo no son una deuda.
  return { esperado, diferencia, cubreTotal: diferencia >= -0.5 };
}

/** Texto del estado para el portal y para la cola del club. */
export const ESTADO_PAGO_LABEL: Record<EstadoPago, string> = {
  PENDIENTE: "Falta el comprobante",
  EN_REVISION: "Comprobante en revisión",
  APROBADO: "Pago aprobado",
  RECHAZADO: "Comprobante rechazado",
};

/**
 * Lo que el pedido espera que el socio transfiera: **aporte + envío**.
 *
 * El envío estaba sumado a mano en el tablero y en ningún lado en la cola de aportes: el mismo pedido
 * mostraba 224 en Pedidos y 199 en Aportes, así que un pago perfecto (199 de aporte + 25 de envío) se
 * leía como «declaró $224 de $199». Un solo cálculo para todas las pantallas.
 *
 * - Pedido de **retiro**: el envío no existe, no se menciona ni se suma.
 * - Pedido de **envío sin costo cargado**: `envioSinCosto` lo dice; no se inventa un cero.
 * - **Sin aporte estimado** no hay total contra el que comparar: `esperado` queda en `null`.
 */
export type EsperadoPedido = {
  /** Total a transferir (aporte + envío), o null si no hay aporte estimado. */
  esperado: number | null;
  aporte: number | null;
  /** Sólo tiene valor cuando el pedido es de envío y el club cargó el costo. */
  envio: number | null;
  /** El pedido es de envío pero no tiene costo cargado: se dice, no se suma 0. */
  envioSinCosto: boolean;
};

export function esperadoDelPedido(params: {
  /** Acepta los `Decimal` de Prisma, sus strings o number: la pantalla no convierte nada antes. */
  aporte: unknown;
  envio: unknown;
  modo: "RETIRO" | "ENVIO" | string | null | undefined;
}): EsperadoPedido {
  const n = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const num = typeof v === "number" ? v : Number(String(v));
    return Number.isFinite(num) ? num : null;
  };
  const aporte = n(params.aporte);
  const esEnvio = params.modo === "ENVIO";
  const envio = esEnvio ? n(params.envio) : null;
  const envioSinCosto = esEnvio && envio == null;
  if (aporte == null) return { esperado: null, aporte: null, envio, envioSinCosto };
  const total = Math.round((aporte + (envio ?? 0)) * 100) / 100;
  return { esperado: total, aporte, envio, envioSinCosto };
}

/**
 * El desglose en palabras, con el formateador de cada pantalla: «aporte $199 + envío $25».
 * Va aparte del cálculo para que el texto y el número no puedan separarse.
 */
export function detalleEsperado(e: EsperadoPedido, formato: (n: number) => string): string | null {
  if (e.aporte == null) return null;
  if (e.envio != null) return `aporte ${formato(e.aporte)} + envío ${formato(e.envio)}`;
  if (e.envioSinCosto) return `aporte ${formato(e.aporte)} · envío sin costo cargado`;
  return `aporte ${formato(e.aporte)}`;
}
