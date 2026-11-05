/**
 * El envío, del lado del socio: ¿me llega?, ¿cuánto sale?, ¿cuánto me falta?
 *
 * Antes el socio elegía «Envío a domicilio», escribía la dirección y descubría el costo recién al
 * confirmar —o descubría que su código postal no servía—. Los referentes que funcionan (Eaze, Dris,
 * Doobiez) resuelven eso **antes** de armar el pedido: primero la elegibilidad, después el catálogo.
 *
 * Lo que se decide acá es puro y testeable: dado un código postal y las zonas que el club configuró,
 * cuál le corresponde. El rango postal es una aproximación honesta —CABA, el conurbano y el interior
 * no se distinguen por código de cuatro dígitos— y por eso nunca cambia la zona a escondidas: la
 * sugiere, y el socio la puede corregir.
 */
import type { Envio } from "./precios";

export type Cobertura =
  | { estado: "SIN_CP" }
  | { estado: "SIN_ZONAS" }
  | { estado: "SIN_COBERTURA"; cp: string; motivo: string }
  | { estado: "CUBIERTA"; cp: string; zona: Envio; aproximada: boolean; motivo: string };

const cuatroDigitos = (cp: string | null | undefined) => {
  const m = (cp ?? "").replace(/\D/g, "").match(/\d{4}/);
  return m ? m[0] : null;
};

const buscar = (zonas: Envio[], ...claves: string[]) =>
  zonas.find((z) => {
    const n = z.zona.toLowerCase();
    return claves.some((k) => n.includes(k));
  });

/**
 * Rango postal argentino por tramos. `aproximada` avisa cuando la zona surge del rango y no de una
 * tabla fina: el 1.er y 2.º cordón del conurbano comparten rango, y el club los cobra distinto.
 */
export function zonaPorCp(cp: string | null | undefined, zonas: Envio[]): Cobertura {
  if (!zonas.length) return { estado: "SIN_ZONAS" };
  const limpio = cuatroDigitos(cp);
  if (!limpio) return { estado: "SIN_CP" };

  const n = Number(limpio);
  const interior = buscar(zonas, "interior", "resto", "país", "pais", "nacional");

  if (n >= 1000 && n <= 1499) {
    const zona = buscar(zonas, "caba", "capital", "ciudad");
    if (zona) return { estado: "CUBIERTA", cp: limpio, zona, aproximada: false, motivo: "Capital Federal" };
    return { estado: "SIN_COBERTURA", cp: limpio, motivo: "no hay una zona de CABA en la configuración del club" };
  }

  if (n >= 1500 && n <= 1999) {
    const zona = buscar(zonas, "1er", "primer", "cordon", "cordón") ?? buscar(zonas, "gran buenos aires", "gba");
    if (zona)
      return {
        estado: "CUBIERTA",
        cp: limpio,
        zona,
        aproximada: true,
        motivo: "conurbano: el cordón exacto lo confirma el club al despachar",
      };
    return { estado: "SIN_COBERTURA", cp: limpio, motivo: "no hay una zona del conurbano en la configuración del club" };
  }

  if (interior)
    return { estado: "CUBIERTA", cp: limpio, zona: interior, aproximada: false, motivo: "interior del país" };

  return { estado: "SIN_COBERTURA", cp: limpio, motivo: "el club no tiene una zona configurada para ese código postal" };
}

/**
 * Cuántos gramos faltan para llegar al mínimo de envío. Si ya lo alcanza, 0.
 *
 * Va en el carrito y no en un mensaje de error: el mismo dato, dicho antes, evita el pedido rechazado.
 */
export function faltaParaMinimo(grams: number, minimoG: number): number {
  if (!(minimoG > 0)) return 0;
  const falta = Math.round((minimoG - grams) * 100) / 100;
  return falta > 0 ? falta : 0;
}
