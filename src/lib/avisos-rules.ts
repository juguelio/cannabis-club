/**
 * Reglas del aviso de vencimiento del REPROCANN (puras, testeables sin base).
 *
 * El aviso tiene que ser uno por vencimiento, no uno por día: si el cron corre todos los días y
 * escribe cada vez, el socio recibe treinta mails iguales y el club deja de creerle a la cola.
 * El «episodio» es la fecha de vencimiento: cambia cuando el socio renueva, y ahí vuelve a avisar.
 */

/** Días que faltan para el vencimiento, medidos en fecha (no en horas). Negativo = ya venció. */
export function diasHastaVencer(expira: Date | null, hoy: Date): number | null {
  if (!expira) return null;
  const a = Date.UTC(expira.getUTCFullYear(), expira.getUTCMonth(), expira.getUTCDate());
  const b = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  return Math.round((a - b) / 86_400_000);
}

/** Clave del episodio: la fecha de vencimiento en ISO corto. */
export function episodioDeVencimiento(expira: Date): string {
  return `vence:${expira.toISOString().slice(0, 10)}`;
}

/**
 * ¿Entra en la ventana de aviso? Se avisa desde el día en que faltan `umbral` días hasta el
 * vencimiento (día 0). Vencido ya no es «por vencer»: eso lo muestra la cola con otro motivo.
 */
export function enVentanaDeAviso(dias: number | null, umbral: number): boolean {
  if (dias == null) return false;
  return dias >= 0 && dias <= umbral;
}

export function textoAvisoVencimiento(input: { nombre: string; dias: number; club: string; expira?: Date | null }): string {
  const cuando =
    input.dias === 0 ? "vence hoy" : input.dias === 1 ? "vence mañana" : `vence en ${input.dias} días`;
  const fecha = input.expira ? ` (${fechaLarga(input.expira)})` : "";
  return [
    `Hola ${input.nombre}: tu REPROCANN ${cuando}${fecha}.`,
    "",
    `Sin el trámite al día no vas a poder retirar ni recibir tu producción en ${input.club}.`,
    "Si todavía no lo renovaste, el trámite se hace en el sitio de REPROCANN del Ministerio de Salud.",
    "Cuando lo tengas, subí la credencial nueva en el portal del socio y el club la valida.",
    "",
    input.club,
  ].join("\n");
}

/** Cómo suena el aviso según cuánto falta. El de un mes informa; el de la última semana apura. */
export type TonoVencimiento = "mes" | "cerca" | "hoy";

export function tonoDeAviso(dias: number): TonoVencimiento {
  if (dias >= 21) return "mes";
  if (dias >= 1) return "cerca";
  return "hoy";
}

/** Fecha larga en español, en UTC: la del padrón es una fecha, no un instante. */
export function fechaLarga(expira: Date): string {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(expira);
}

/**
 * El copy del aviso, separado del layout: lo que dice el mail es del negocio, cómo se ve es de la
 * plantilla. Todo lo que se afirma acá es lo que el sistema hace después (bloquear la entrega,
 * pedir la credencial nueva en el portal).
 */
export function copyAvisoVencimiento(input: {
  nombre: string;
  dias: number;
  club: string;
  expira: Date;
}): { asunto: string; titulo: string; copete: string; destacado: { etiqueta: string; valor: string }; parrafos: string[] } {
  const { nombre, dias, club, expira } = input;
  const tono = tonoDeAviso(dias);
  const fecha = fechaLarga(expira);
  const asunto =
    tono === "mes"
      ? "Tu REPROCANN vence en un mes"
      : dias === 0
        ? "Tu REPROCANN vence hoy"
        : dias === 1
          ? "Tu REPROCANN vence mañana"
          : `Tu REPROCANN vence en ${dias} días`;

  const copete =
    tono === "mes"
      ? `Hola ${nombre}: tu credencial vence el ${fecha}. Conviene renovarla desde ahora, sin esperar al último momento.`
      : tono === "cerca"
        ? `Hola ${nombre}: quedan ${dias} ${dias === 1 ? "día" : "días"} para que venza tu credencial.`
        : `Hola ${nombre}: hoy es el último día de tu credencial.`;

  const parrafos =
    tono === "mes"
      ? [
          `Con el REPROCANN vencido el club no puede registrar una entrega: el sistema la bloquea hasta que esté renovado. Por eso te avisamos con un mes.`,
          `El trámite de renovación se hace en el sitio de REPROCANN del Ministerio de Salud, con tu usuario: no lo puede hacer ${club} por vos.`,
          "Cuando tengas la credencial nueva, subila desde el portal del socio. La revisamos y tu legajo queda habilitado otra vez.",
        ]
      : [
          `Con el REPROCANN vencido el club no puede registrar una entrega: el sistema la bloquea hasta que esté renovado.`,
          "Si ya lo renovaste, subí la credencial nueva desde el portal y avisanos: la validamos para que puedas retirar.",
          `Si no llegás con los tiempos, escribinos antes de la fecha y vemos cómo seguir.`,
        ];

  return {
    asunto,
    titulo: tono === "mes" ? "Tu REPROCANN vence en un mes" : asunto,
    copete,
    destacado: { etiqueta: "Vence", valor: fecha },
    parrafos,
  };
}
