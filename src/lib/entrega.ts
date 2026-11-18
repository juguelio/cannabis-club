/**
 * Cómo llega el pedido. Son tres formas, no dos.
 *
 * El club lo pidió así el 17/11, mirando el checkout:
 *
 *   «que haya otro botón… que diga "entregamos en su sucursal" y me aparezca la dirección,
 *    poniendo la dirección de la persona pero aclarando envío a sucursal, porque después
 *    nosotros buscamos cuál es su sucursal de Andreani más cercana».
 *
 * El sistema **no** resuelve la sucursal: guarda el domicilio del socio, que es el dato con el
 * que el club la busca. La entrega a sucursal se despacha igual que un envío (sale del club,
 * ocupa la cola de traslados y paga la zona), pero no termina en la puerta del socio.
 */

export const MODOS_ENTREGA = ["RETIRO", "ENVIO", "SUCURSAL"] as const;
export type ModoEntrega = (typeof MODOS_ENTREGA)[number];

/** Sale del club con un transportista: cuenta como despacho y paga zona de envío. */
export function esDespacho(modo?: string | null): boolean {
  return modo === "ENVIO" || modo === "SUCURSAL";
}

/** Va a la sucursal de Andreani más cercana al domicilio y el socio lo retira ahí. */
export function esSucursal(modo?: string | null): boolean {
  return modo === "SUCURSAL";
}

export function esModoEntrega(valor: unknown): valor is ModoEntrega {
  return typeof valor === "string" && (MODOS_ENTREGA as readonly string[]).includes(valor);
}

/** Cómo se llama la forma de entrega en una etiqueta, sin depender del contexto. */
export function tituloEntrega(modo?: string | null): string {
  if (modo === "ENVIO") return "Envío a domicilio";
  if (modo === "SUCURSAL") return "Envío a sucursal Andreani";
  return "Retiro en el club";
}

/** La aclaración que sólo tiene sentido en la sucursal; `null` para el resto. */
export function detalleEntrega(modo?: string | null): string | null {
  if (modo === "SUCURSAL")
    return "Lo llevamos a la sucursal de Andreani más cercana a tu domicilio y lo retirás ahí con tu DNI.";
  return null;
}
