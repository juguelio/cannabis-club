/**
 * La puerta de entrada del socio: qué pantalla le toca apenas entra.
 *
 * Es una función pura a propósito. El orden de las preguntas de un onboarding se rompe fácil cuando
 * vive dentro del JSX de una página, y acá el orden es lo que evita el peor caso: pedirle el DNI y la
 * credencial a alguien que todavía no tiene REPROCANN.
 */

export type DeclaracionReprocann = "TIENE" | "NO_TIENE" | null;

export type EstadoVerificacion = "PENDIENTE" | "EN_REVISION" | "VERIFICADO" | "RECHAZADO";

export type PantallaDeEntrada = "preguntar" | "guia" | "validar" | "portal";

export type EntradaSocio = {
  verificacion: EstadoVerificacion;
  declaracion: DeclaracionReprocann;
};

/**
 * Decisión del club (4-nov-2026): la pregunta es **sólo para el socio no verificado**. Al que ya está
 * verificado no se le pregunta si tiene REPROCANN porque el club ya miró su credencial y la respuesta
 * está en el legajo; volver a preguntarle es ruido. Si algún día se quiere «confirmar datos» para
 * todos, eso es otra pantalla y otro texto, no este wizard.
 *
 * - `portal`: ya está verificado; el trámite terminó y entra directo.
 * - `preguntar`: no sabemos si tiene REPROCANN, así que primero se pregunta (una vez).
 * - `guia`: dijo que no tiene; la guía es la pantalla, no un link escondido.
 * - `validar`: dijo que tiene (o ya empezó el trámite); se le piden los documentos.
 */
export function pantallaDeEntrada({ verificacion, declaracion }: EntradaSocio): PantallaDeEntrada {
  if (verificacion === "VERIFICADO") return "portal";
  if (declaracion === null) return "preguntar";
  if (declaracion === "NO_TIENE") return "guia";
  return "validar";
}

/** El socio ya declaró que no tiene: la guía es lo primero que ve, con el trámite médico adelante. */
export const POR_QUE_LA_GUIA =
  "Sin REPROCANN no se puede vincular a nadie al cultivo: es el permiso que habilita todo lo demás.";
