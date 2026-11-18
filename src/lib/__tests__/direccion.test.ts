import { describe, expect, it } from "vitest";
import { componerDireccion, partesDireccion } from "../direccion";

describe("componerDireccion", () => {
  it("no repite la localidad ni la provincia que ya vienen dentro del domicilio", () => {
    // Caso real del club (foto del 17/11): el padrón trae el domicilio con localidad y
    // provincia adentro, y el checkout las agregaba otra vez.
    const armada = componerDireccion(
      "Antonio “Niño” Ragussi 279, San Martín de los Andes, Neuquén",
      "San Martín de los Andes",
      "Neuquén",
      "8370",
    );
    expect(armada).toBe("Antonio “Niño” Ragussi 279, San Martín de los Andes, Neuquén, 8370");
  });

  it("compara sin mayúsculas ni acentos", () => {
    expect(componerDireccion("Los Notros 195, SAN MARTIN DE LOS ANDES", "San Martín de los Andes")).toBe(
      "Los Notros 195, SAN MARTIN DE LOS ANDES",
    );
  });

  it("no toca palabras repetidas dentro de una misma parte", () => {
    // «Ruta 40 km 40» es una dirección válida: se deduplica por parte, no por palabra.
    expect(componerDireccion("Ruta 40 km 40", "Zapala", "Neuquén")).toBe("Ruta 40 km 40, Zapala, Neuquén");
  });

  it("descarta partes vacías y espacios de más", () => {
    expect(componerDireccion("  Los Notros 195  ", null, "", undefined, "  ", "8370")).toBe("Los Notros 195, 8370");
  });

  it("devuelve cadena vacía cuando no hay nada que mostrar", () => {
    expect(componerDireccion()).toBe("");
    expect(componerDireccion(null, "", "   ")).toBe("");
  });

  it("mantiene el orden de la primera aparición", () => {
    expect(componerDireccion("Calle 1", "Localidad", "Calle 1", "Provincia")).toBe("Calle 1, Localidad, Provincia");
  });

  it("ignora el punto final de una abreviatura al comparar, sin borrarlo", () => {
    expect(componerDireccion("Av. San Martín 100", "Av. San Martín 100")).toBe("Av. San Martín 100");
  });
});

describe("partesDireccion", () => {
  it("separa una dirección compuesta", () => {
    expect(partesDireccion("Ragussi 279, San Martín de los Andes, Neuquén, 8370")).toEqual([
      "Ragussi 279",
      "San Martín de los Andes",
      "Neuquén",
      "8370",
    ]);
  });

  it("devuelve lista vacía sin dirección", () => {
    expect(partesDireccion(null)).toEqual([]);
    expect(partesDireccion("  ")).toEqual([]);
  });
});
