/**
 * Reglas de la carta del club, sin base de datos: qué contenido es publicable, quién la recibe y
 * qué transiciones de estado se permiten. Se prueban solas y las usan tanto las rutas como la
 * pantalla, así la consola no puede ofrecer un botón que el servidor va a rechazar.
 */
import type { BloqueCarta } from "./carta-template";

export type ContenidoCarta = {
  edicion: string;
  titulo: string;
  copete: string;
  apertura: string[];
  bloques: BloqueCarta[];
  cta?: { texto: string; url: string };
};

export type EstadoCarta = "BORRADOR" | "APROBADA" | "ENVIANDO" | "ENVIADA" | "CANCELADA";

const LIMITES = { titulo: 90, copete: 240, bloques: 6, parrafo: 900 } as const;

/** Lo que falta para que la carta se pueda publicar. Devuelve frases para mostrar, no códigos. */
export function faltantesDeCarta(c: ContenidoCarta): string[] {
  const faltan: string[] = [];
  if (!c.edicion.trim()) faltan.push("Falta cómo se llama la edición (por ejemplo «noviembre 2026»).");
  if (!c.titulo.trim()) faltan.push("Falta el título.");
  if (c.titulo.length > LIMITES.titulo) faltan.push(`El título pasa de ${LIMITES.titulo} caracteres.`);
  if (!c.copete.trim()) faltan.push("Falta la bajada: una o dos líneas que resuman la carta.");
  if (c.copete.length > LIMITES.copete) faltan.push(`La bajada pasa de ${LIMITES.copete} caracteres.`);
  if (!c.apertura.length || !c.apertura.some((p) => p.trim())) faltan.push("Falta el primer párrafo.");
  c.apertura.forEach((p, i) => {
    if (p.length > LIMITES.parrafo) faltan.push(`El párrafo ${i + 1} pasa de ${LIMITES.parrafo} caracteres.`);
  });
  if (!c.bloques.length) faltan.push("Falta al menos un bloque.");
  if (c.bloques.length > LIMITES.bloques) faltan.push(`Son ${c.bloques.length} bloques y el máximo es ${LIMITES.bloques}.`);
  c.bloques.forEach((b, i) => {
    if (!b.titulo.trim()) faltan.push(`El bloque ${i + 1} no tiene título.`);
    if (!b.texto.trim()) faltan.push(`El bloque ${i + 1} no tiene texto.`);
    if (b.enlace && (!b.enlace.texto.trim() || !/^https?:\/\//.test(b.enlace.url))) {
      faltan.push(`El enlace del bloque ${i + 1} necesita texto y una dirección que empiece con http.`);
    }
  });
  if (c.cta && (!c.cta.texto.trim() || !/^https?:\/\//.test(c.cta.url))) {
    faltan.push("El botón necesita texto y una dirección que empiece con http.");
  }
  return faltan;
}

/** Se edita mientras nadie la haya aprobado: después, el contenido es el que se aprobó. */
export const puedeEditarse = (estado: EstadoCarta) => estado === "BORRADOR";

/** Aprobar es el acto humano: sólo desde borrador, y sólo por un ADMIN en la ruta. */
export const puedeAprobarse = (estado: EstadoCarta) => estado === "BORRADOR";

/** Sale si está aprobada y llegó la hora. `ENVIANDO` no se re-dispara: la corrida en curso la retoma
 *  el mismo proceso; si se murió, el candado por socio evita repetir y el cron la vuelve a tomar. */
export const puedeEnviarse = (estado: EstadoCarta) => estado === "APROBADA" || estado === "ENVIANDO";

export function puedeCancelarse(estado: EstadoCarta) {
  return estado === "BORRADOR" || estado === "APROBADA";
}

export type CandidatoCarta = {
  id: string;
  legajo: number;
  nombre: string;
  email: string | null;
  /** Estado del legajo, tal como está en el padrón. */
  status: "PENDIENTE" | "ACTIVO" | "SUSPENDIDO" | "BAJA";
  /** Si tiene COMUNICACIONES vigente (otorgado y no revocado). */
  comunicaciones: boolean;
};

export type RepartoCarta = {
  alcanzables: CandidatoCarta[];
  excluidos: { legajo: number; nombre: string; motivo: string }[];
};

/**
 * A quién le llega la carta.
 *
 * Tres filtros, en este orden y por este motivo:
 * 1. **Legajo activo** — un pendiente no es socio todavía y un baja no quiere saber más del club.
 * 2. **Con email** — sin dirección no hay a dónde mandar.
 * 3. **Con COMUNICACIONES vigente** — la carta es novedad, no trámite: sin consentimiento no sale.
 */
export function repartirCarta(candidatos: CandidatoCarta[]): RepartoCarta {
  const alcanzables: CandidatoCarta[] = [];
  const excluidos: RepartoCarta["excluidos"] = [];
  for (const c of candidatos) {
    const motivo = !c.email
      ? "sin email"
      : c.status !== "ACTIVO"
        ? `legajo ${c.status.toLowerCase()}`
        : !c.comunicaciones
          ? "sin consentimiento de comunicaciones"
          : null;
    if (motivo) excluidos.push({ legajo: c.legajo, nombre: c.nombre, motivo });
    else alcanzables.push(c);
  }
  return { alcanzables, excluidos };
}
