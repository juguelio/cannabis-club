/**
 * El carrito de la producción: qué variedades y cuántos gramos de cada una.
 *
 * Antes el socio escribía un número («15 g») y el club decidía qué cepa preparar. Con el carrito
 * elige él, variedad por variedad, como en cualquier tienda: es la diferencia entre pedir «15 g» y
 * pedir «10 g de Limonada y 5 g de Viva».
 *
 * Dos reglas que no son de la interfaz y por eso viven acá, fuera del JSX:
 *
 * - **El tope es del socio, no del renglón.** Se reparte entre las variedades que elija; ningún
 *   renglón puede pasarse del total, y el total no puede pasarse del tope del mes.
 * - **Se suma de a 5 g**, que es como el club fracciona. Un carrito de 3 g no se puede preparar.
 */
export const PASO_G = 5;

export type ItemCarrito = { strainId: string; gramos: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

export const totalCarrito = (items: ItemCarrito[]) => r2(items.reduce((s, i) => s + i.gramos, 0));

export const gramosDe = (items: ItemCarrito[], strainId: string) =>
  items.find((i) => i.strainId === strainId)?.gramos ?? 0;

export const topeAlcanzado = (items: ItemCarrito[], tope: number) => totalCarrito(items) >= tope - 1e-9;

/**
 * Suma o resta un paso (de 5 g por defecto) sin pasarse del tope del socio.
 *
 * Devuelve una lista nueva sin el renglón cuando llega a cero: un renglón en 0 no es un pedido de
 * nada y ensucia el resumen y el correo al club.
 */
export function moverItem(items: ItemCarrito[], strainId: string, paso: number, tope: number): ItemCarrito[] {
  const actual = gramosDe(items, strainId);
  const resto = totalCarrito(items) - actual;
  const maximoPosible = r2(tope - resto);
  const propuesto = r2(Math.max(0, Math.min(actual + paso, maximoPosible)));

  if (propuesto <= 0) return items.filter((i) => i.strainId !== strainId);
  const otros = items.filter((i) => i.strainId !== strainId);
  return [...otros, { strainId, gramos: propuesto }];
}

/** Cuántos gramos más entran en el carrito sin pasarse del tope. */
export const disponibleCarrito = (items: ItemCarrito[], tope: number) => r2(Math.max(0, tope - totalCarrito(items)));

/**
 * Fija los gramos de una variedad de una vez: es lo que hace la cantidad rápida («20 g»).
 *
 * Respeta el tope del socio recortando el resto, y nunca deja un renglón más grande que lo que queda
 * libre. Si el socio ponía 10 g de una cepa y toca 20 g en otra, la primera no desaparece por arte de
 * magia: se le descuenta lo que hacía falta.
 */
export function fijarItem(items: ItemCarrito[], strainId: string, gramos: number, tope: number): ItemCarrito[] {
  const otros = items.filter((i) => i.strainId !== strainId);
  const resto = totalCarrito(otros);
  const objetivo = r2(Math.max(0, Math.min(gramos, r2(tope - resto))));
  if (objetivo <= 0) return otros;
  return [...otros, { strainId, gramos: objetivo }];
}

/** Saca la variedad del carrito entera. */
export const quitarItem = (items: ItemCarrito[], strainId: string) =>
  items.filter((i) => i.strainId !== strainId);

/**
 * Lo que se manda al servidor. El servidor vuelve a validar topes, stock y verificación: esto sólo
 * evita que el socio llegue al final con un pedido que no iba a poder hacerse.
 */
export function aEnviar(items: ItemCarrito[]) {
  return items.filter((i) => i.gramos > 0).map((i) => ({ strainId: i.strainId, grams: i.gramos }));
}
