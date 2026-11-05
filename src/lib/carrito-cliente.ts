"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { PASO_G, moverItem, totalCarrito, type ItemCarrito } from "./carrito";

/**
 * El carrito tiene que sobrevivir a la navegación: el socio elige en el catálogo, revisa en el basket
 * y confirma en el envío, que son tres rutas distintas. Se guarda en `localStorage` y se sincroniza
 * entre componentes y pestañas con `useSyncExternalStore`, que es la forma de leer un almacén externo
 * sin caer en `setState` dentro de un efecto (y sin el parpadeo del primer render).
 *
 * Una sola fuente de verdad: si cada pantalla tuviera su estado, dos totales distintos convivirían.
 */
const CLAVE = "cc_carrito_v1";
const EVENTO = "cc-carrito";

function suscribir(alCambiar: () => void) {
  window.addEventListener(EVENTO, alCambiar);
  window.addEventListener("storage", alCambiar);
  return () => {
    window.removeEventListener(EVENTO, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

const leerCrudo = () => {
  try {
    return window.localStorage.getItem(CLAVE) ?? "";
  } catch {
    return "";
  }
};

export function parsearCarrito(crudo: string): ItemCarrito[] {
  if (!crudo) return [];
  try {
    const datos = JSON.parse(crudo) as ItemCarrito[];
    if (!Array.isArray(datos)) return [];
    return datos
      .filter((i) => i && typeof i.strainId === "string" && Number(i.gramos) > 0)
      .map((i) => ({ strainId: i.strainId, gramos: Number(i.gramos) }));
  } catch {
    return [];
  }
}

export function leerCarrito(): ItemCarrito[] {
  if (typeof window === "undefined") return [];
  return parsearCarrito(leerCrudo());
}

export function guardarCarrito(items: ItemCarrito[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLAVE, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENTO));
}

export function useCarrito(tope: number) {
  const crudo = useSyncExternalStore(suscribir, leerCrudo, () => "");
  const items = useMemo(() => parsearCarrito(crudo), [crudo]);
  // En el servidor el almacén todavía no existe y `crudo` llega vacío: así no se muestra «basket
  // vacío» antes de saber si el socio tiene algo guardado.
  const listo = crudo !== "";

  const aplicar = useCallback((nuevos: ItemCarrito[]) => guardarCarrito(nuevos), []);

  const delta = useCallback(
    (strainId: string, paso: number) => aplicar(moverItem(leerCarrito(), strainId, paso, tope)),
    [aplicar, tope],
  );
  const quitar = useCallback((strainId: string) => aplicar(leerCarrito().filter((i) => i.strainId !== strainId)), [aplicar]);
  const vaciar = useCallback(() => aplicar([]), [aplicar]);

  return {
    items,
    listo,
    total: totalCarrito(items),
    contar: items.length,
    delta,
    quitar,
    vaciar,
    setItems: aplicar,
    paso: PASO_G,
  };
}
