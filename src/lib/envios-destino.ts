/**
 * Envíos por destino.
 *
 * El club pidió ver «a dónde se fue la plata de los envíos» para decidir si sigue despachando
 * o abre una sede (audios del 17/11). Este módulo es el cálculo puro: agrupa los envíos
 * despachados por localidad y suma gramos, envío y aporte. La consulta vive en
 * `envios-destino-server.ts`.
 *
 * El destino se lee de la localidad del socio —el `deliveryAddress` es texto libre y no sirve
 * para agrupar—, con la zona como respaldo y «Sin localidad» al final.
 */

export type FilaEnvio = {
  /** Localidad del socio al momento de consultar. */
  localidad: string | null;
  /** Zona de envío congelada en el pedido. Respaldo cuando falta la localidad. */
  zona: string | null;
  grams: number;
  costoEnvio: number;
  aporte: number;
};

export type DestinoResumen = {
  destino: string;
  envios: number;
  gramos: number;
  costoEnvio: number;
  aporte: number;
  total: number;
};

export type TotalesDestino = {
  destinos: number;
  envios: number;
  gramos: number;
  costoEnvio: number;
  aporte: number;
  total: number;
};

const SIN_LOCALIDAD = "Sin localidad";

/** Nombre del destino de una fila: localidad, o la zona entre paréntesis, o «Sin localidad». */
export function destinoDeFila(fila: Pick<FilaEnvio, "localidad" | "zona">) {
  const localidad = fila.localidad?.replace(/\s+/g, " ").trim();
  if (localidad) return localidad;
  const zona = fila.zona?.replace(/\s+/g, " ").trim();
  if (zona) return `Zona: ${zona}`;
  return SIN_LOCALIDAD;
}

/**
 * Agrupa por destino. Ordena por cantidad de envíos (lo que más se despacha primero) y, a
 * igual cantidad, por plata gastada; los empates se resuelven alfabéticamente para que la
 * tabla no cambie de orden entre consultas iguales.
 */
export function agruparPorDestino(filas: FilaEnvio[]): DestinoResumen[] {
  const mapa = new Map<string, DestinoResumen>();

  for (const f of filas) {
    const destino = destinoDeFila(f);
    const actual = mapa.get(destino) ?? {
      destino,
      envios: 0,
      gramos: 0,
      costoEnvio: 0,
      aporte: 0,
      total: 0,
    };
    actual.envios += 1;
    actual.gramos += f.grams;
    actual.costoEnvio += f.costoEnvio;
    actual.aporte += f.aporte;
    actual.total += f.aporte + f.costoEnvio;
    mapa.set(destino, actual);
  }

  return [...mapa.values()]
    .map((d) => ({
      ...d,
      gramos: redondear(d.gramos),
      costoEnvio: redondear(d.costoEnvio),
      aporte: redondear(d.aporte),
      total: redondear(d.total),
    }))
    .sort(
      (a, b) =>
        b.envios - a.envios || b.costoEnvio - a.costoEnvio || a.destino.localeCompare(b.destino, "es-AR"),
    );
}

/** Totales del período: una sola fila para el pie de la tabla. */
export function totalesDestino(filas: DestinoResumen[]): TotalesDestino {
  return filas.reduce<TotalesDestino>(
    (acc, f) => ({
      destinos: acc.destinos + 1,
      envios: acc.envios + f.envios,
      gramos: redondear(acc.gramos + f.gramos),
      costoEnvio: redondear(acc.costoEnvio + f.costoEnvio),
      aporte: redondear(acc.aporte + f.aporte),
      total: redondear(acc.total + f.total),
    }),
    { destinos: 0, envios: 0, gramos: 0, costoEnvio: 0, aporte: 0, total: 0 },
  );
}

export const PERIODOS = ["mes", "trimestre", "anio"] as const;
export type Periodo = (typeof PERIODOS)[number];

export function esPeriodo(valor: string | undefined | null): valor is Periodo {
  return !!valor && (PERIODOS as readonly string[]).includes(valor);
}

export type Rango = { desde: Date; hasta: Date; etiqueta: string; periodo: Periodo };

/**
 * Rango de fechas del período, en horario local del club.
 *
 * `mes`: el mes en curso. `trimestre`: los tres meses en curso (el 1º de dos meses atrás
 * hasta hoy). `anio`: el año en curso. «Hasta» es el fin del día de hoy para incluir lo
 * despachado hoy mismo.
 */
export function rangoPeriodo(periodo: Periodo, ahora = new Date()): Rango {
  const hasta = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);
  let desde: Date;
  let etiqueta: string;

  if (periodo === "anio") {
    desde = new Date(ahora.getFullYear(), 0, 1);
    etiqueta = `Año ${ahora.getFullYear()}`;
  } else if (periodo === "trimestre") {
    desde = new Date(ahora.getFullYear(), ahora.getMonth() - 2, 1);
    etiqueta = "Últimos 3 meses";
  } else {
    desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    etiqueta = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(ahora);
  }

  return { desde, hasta, etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1), periodo };
}

function redondear(n: number) {
  return Math.round(n * 100) / 100;
}
