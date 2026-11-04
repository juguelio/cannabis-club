/**
 * Guía del trámite REPROCANN para el socio.
 *
 * Fuente: la mini página de recepción del consultorio del Dr. Javier Victorica (director médico del
 * club), reconstruida el 2026-11-04. Todo lo de acá es **dato**, no maqueta: la página lo dibuja con
 * el lenguaje del sitio. Si el consultorio cambia un valor, un profesional o un estado, se toca este
 * archivo y no el JSX.
 *
 * Regla que ordena el contenido: el trámite **lo hace el socio**. El club vincula, entrega y avisa
 * cuando vence; no puede iniciar ni aprobar nada en REPROCANN, y la página no puede sugerir lo
 * contrario. Por lo mismo el club no cobra la consulta: el pago es al consultorio.
 */

export const GUIA = {
  consultorio: "Dr. Javier Victorica y equipo",
  director: "Javier Victorica · Director médico",
  especialidad: "Medicina integrativa · Cannabis terapéutico",
  modalidad: "Videollamada por Google Meet, desde donde estés",
  /**
   * Valores que fija el consultorio, no el club. **No se publican todavía**: el sitio público del club
   * dice $50.000 (`Club.marca.sitio.pasos`) y el consultorio pasó $60.000 el 4-nov-2026. El club
   * confirmó que **rige el del consultorio** y que el sitio se corrige, así que se publica. Si el
   * valor vuelve a cambiar, se toca acá y en `Club.marca.sitio.pasos`: son los dos lugares donde el
   * número se ve.
   */
  valorConsultaArs: 60_000,
  valorVinculacionArs: 40_000,
  /** El club confirmó el 4-nov-2026 que rige el valor del consultorio y que el sitio se actualiza. */
  publicarValores: true,
  whatsapp: "5491131482320",
  whatsappLegible: "+54 9 11 3148-2320",
  instagram: "codigoverde8",
} as const;

export type Profesional = { nombre: string; via: string; url: string };

/** Los tres atienden la misma consulta y hacen la carga del trámite. */
export const PROFESIONALES: Profesional[] = [
  {
    nombre: "Javier Victorica",
    via: "Agenda online",
    url: "https://doodle.com/bp/javiervictorica/turnos-para-consulta-mdica-o-reprocann",
  },
  {
    nombre: "Paula Barreiro",
    via: "Turnos por WhatsApp",
    url: `https://wa.me/5491131243144?text=${encodeURIComponent("Hola Paula, te escribo para solicitar un turno para sacar el REPROCANN")}`,
  },
  {
    nombre: "Federico Brodschi",
    via: "Agenda online",
    url: "https://doodle.com/bp/federicobrodschi/consulta-reprocann-dr-federico-brodschi",
  },
];

export type Paso = { titulo: string; texto: string };

/** El orden importa: el trámite se traba justo cuando alguien se saltea un paso. */
export const PASOS: Paso[] = [
  {
    titulo: "Pedí el turno",
    texto: "Elegí con quién atenderte y reservá. La consulta es por videollamada, por Google Meet.",
  },
  {
    titulo: "Hacé la consulta",
    texto:
      "El médico repasa tus síntomas, antecedentes y medicación, arma tu historia clínica y te indica el tratamiento.",
  },
  {
    titulo: "El consultorio carga el trámite",
    texto:
      "Con el pago acreditado, el equipo lo carga en REPROCANN y te manda un instructivo con los pasos que te tocan a vos.",
  },
  {
    titulo: "Aceptá los términos en REPROCANN",
    texto:
      "Entrás a REPROCANN con tu cuenta, buscás el trámite y aceptás los términos y condiciones. Hasta que no lo aceptás, el club no puede vincularte.",
  },
  {
    titulo: "El club te vincula",
    texto:
      "Aceptados los términos, el club te asocia como paciente del cultivo. Es el paso que destraba el trámite y no lo puede hacer el consultorio.",
  },
  {
    titulo: "Descargá la credencial",
    texto:
      "Cuando REPROCANN aprueba, descargás tu credencial y la subís al portal. Sin credencial vigente el club no puede entregarte.",
  },
];

export type EstadoTrabado = { estado: string; queHacer: string };

/** Los cuatro estados con los que llega el socio cuando dice «mi trámite no avanza». */
export const ESTADOS_TRABADOS: EstadoTrabado[] = [
  {
    estado: "Pendiente de consentimiento del paciente",
    queHacer: "Te falta aceptar los términos y condiciones. Entrá al trámite y aceptalos.",
  },
  {
    estado: "Pendiente de vinculación con cultivador",
    queHacer: "El club todavía no te vinculó. Avisale que ya aceptaste los términos.",
  },
  {
    estado: "Pendiente de evaluación",
    queHacer:
      "Lo está revisando REPROCANN. Los trámites iniciados desde marzo de 2026 suelen aprobarse rápido; los anteriores tienen otro sistema y pueden demorar mucho.",
  },
  {
    estado: "Revisión médica",
    queHacer: "REPROCANN le pidió una corrección al médico. Escribinos y lo resolvemos.",
  },
];

export type Tiempo = { tipo: string; texto: string };

export const TIEMPOS: Tiempo[] = [
  { tipo: "Autocultivo", texto: "Suele aprobarse en pocos días." },
  {
    tipo: "Socio de un club que cultiva por vos",
    texto: "Puede tardar algunas semanas, porque se suma la vinculación con el club.",
  },
];

export const NOTAS = {
  quienHaceElTramite:
    "El trámite lo hace el socio. El club no puede iniciarlo, aprobarlo ni adelantarlo: vincula tu legajo al cultivo y te avisa cuando la credencial está por vencer.",
  pago:
    "El pago es al consultorio, por transferencia: los datos te los pasan por WhatsApp. Conviene que esté hecho antes de la consulta para que la reserva quede confirmada, y el comprobante va por el mismo chat. El club no cobra la consulta ni interviene en el pago.",
  control:
    "Aprobado el trámite, los socios de clubes del país deben hacerse un control médico cada 6 meses, según la reglamentación del Ministerio de Salud.",
  trabado:
    "Si el club te dice que «el trámite no existe», casi siempre es porque todavía no aceptaste los términos y condiciones.",
  tiempos: "Los tiempos los maneja REPROCANN. Si se demora más de lo habitual, escribinos.",
  vinculacion:
    "Si ya tenés REPROCANN y te querés sumar al club, no hace falta un trámite nuevo.",
  club:
    "De parte de qué club venís: es la primera pregunta del turno, y es lo que después permite que te vinculemos.",
} as const;

/** Pesos argentinos sin decimales: $60.000. */
export function pesos(valor: number): string {
  return `$${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(valor)}`;
}

/** Link de WhatsApp con el mensaje ya escrito, para que el socio sólo apriete. */
export function whatsappGuia(mensaje = "Hola, te escribo por el trámite de mi REPROCANN"): string {
  return `https://wa.me/${GUIA.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

export const INSTAGRAM_URL = `https://www.instagram.com/${GUIA.instagram}`;
