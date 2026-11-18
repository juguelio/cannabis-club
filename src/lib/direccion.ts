/**
 * Direcciones sin repetir.
 *
 * `Member.address` es texto libre: en el padrón importado muchos socios quedaron con la
 * localidad y la provincia adentro del campo (`«Ragussi 279, San Martín de los Andes,
 * Neuquén»`) y además con `locality`/`province` completos. Concatenar los cuatro campos
 * tal cual producía `«…, San Martín de los Andes, Neuquén, San Martín de los Andes,
 * Neuquén, 8370»` en el checkout y en el snapshot que va al despacho.
 *
 * Se resuelve al mostrar, no al guardar: los datos del socio no se tocan y cualquier
 * pantalla que componga direcciones usa el mismo criterio.
 */

/** Parte comparable: sin acentos, minúsculas, espacios colapsados y sin puntos de abreviatura. */
function comparable(parte: string) {
  return parte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;]+$/g, "")
    .trim();
}

/**
 * Compone una dirección a partir de partes que pueden solaparse.
 *
 * Parte cada argumento por coma (porque un campo libre puede traer varias partes juntas),
 * descarta vacíos y repeticiones —comparando sin mayúsculas ni acentos— y conserva el
 * orden de la primera aparición. No reordena ni corrige nada más.
 *
 * `componerDireccion("Ragussi 279, San Martín de los Andes", "San Martín de los Andes", "Neuquén", "8370")`
 * → `"Ragussi 279, San Martín de los Andes, Neuquén, 8370"`
 */
export function componerDireccion(...partes: Array<string | null | undefined>) {
  const vistas = new Set<string>();
  const salida: string[] = [];

  for (const parte of partes) {
    if (!parte) continue;
    for (const trozo of String(parte).split(",")) {
      const limpio = trozo.replace(/\s+/g, " ").trim();
      if (!limpio) continue;
      const clave = comparable(limpio);
      if (!clave || vistas.has(clave)) continue;
      vistas.add(clave);
      salida.push(limpio);
    }
  }

  return salida.join(", ");
}

/** Partes de una dirección ya compuesta, sin vacíos. Útil para mostrar en varias líneas. */
export function partesDireccion(direccion: string | null | undefined) {
  if (!direccion) return [];
  return direccion
    .split(",")
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
