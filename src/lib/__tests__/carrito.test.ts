import { describe, expect, it } from "vitest";
import { aEnviar, disponibleCarrito, gramosDe, moverItem, PASO_G, topeAlcanzado, totalCarrito } from "../carrito";

const A = "cepa-a";
const B = "cepa-b";

describe("carrito de producción", () => {
  it("suma los gramos de todas las variedades", () => {
    expect(totalCarrito([{ strainId: A, gramos: 10 }, { strainId: B, gramos: 5 }])).toBe(15);
  });

  it("suma de a 5 g", () => {
    expect(PASO_G).toBe(5);
  });

  it("no deja pasar el tope del socio, aunque el renglón quiera más", () => {
    const items = moverItem([{ strainId: A, gramos: 30 }], B, 20, 40);
    expect(totalCarrito(items)).toBe(40);
    expect(gramosDe(items, B)).toBe(10);
  });

  it("bajar a cero saca el renglón: no se reserva nada de una variedad que no se eligió", () => {
    const items = moverItem([{ strainId: A, gramos: 5 }], A, -5, 40);
    expect(items).toEqual([]);
  });

  it("no permite bajar de cero", () => {
    expect(moverItem([], A, -5, 40)).toEqual([]);
  });

  it("sabe cuánto queda libre", () => {
    expect(disponibleCarrito([{ strainId: A, gramos: 15 }], 40)).toBe(25);
    expect(topeAlcanzado([{ strainId: A, gramos: 40 }], 40)).toBe(true);
  });

  it("al servidor van sólo los renglones con gramos", () => {
    expect(aEnviar([{ strainId: A, gramos: 10 }, { strainId: B, gramos: 0 }])).toEqual([{ strainId: A, grams: 10 }]);
  });
});
