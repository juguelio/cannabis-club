/**
 * Avisos por email. Se usa la API HTTP de Resend, sin SDK: una dependencia menos.
 * Sin `RESEND_API_KEY` y `CLUB_MAIL_FROM` configurados no se manda nada y se informa
 * el motivo: el alta y el rechazo funcionan igual, el aviso es un extra.
 */
export type EmailInput = { to: string; subject: string; text: string };
export type EmailResultado = { enviado: boolean; motivo?: "sin_configurar" | "error"; detalle?: string };

const RESEND = "https://api.resend.com/emails";

export const mailerConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.CLUB_MAIL_FROM);

export async function enviarEmail({ to, subject, text }: EmailInput): Promise<EmailResultado> {
  if (!mailerConfigured()) return { enviado: false, motivo: "sin_configurar" };
  try {
    const r = await fetch(RESEND, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: process.env.CLUB_MAIL_FROM, to: [to], subject, text }),
    });
    if (!r.ok) return { enviado: false, motivo: "error", detalle: `${r.status} ${(await r.text()).slice(0, 200)}` };
    return { enviado: true };
  } catch (error) {
    return { enviado: false, motivo: "error", detalle: error instanceof Error ? error.message : "desconocido" };
  }
}

/** Texto del aviso de alta aprobada: qué pasó, con qué legajo y qué hacer ahora. */
export function textoAprobado(params: { nombre: string; legajo: number; club: string; url: string }) {
  return [
    `Hola ${params.nombre}:`,
    "",
    `Revisamos tu documentación y tu alta en ${params.club} quedó aprobada. Tu legajo es el ${params.legajo}.`,
    "",
    "Ya podés entrar al portal del socio con el mismo botón de Google que usaste para registrarte:",
    params.url,
    "",
    "Ahí vas a ver tu carnet, tus topes del mes y podés reservar turno.",
    "",
    `— ${params.club}`,
  ].join("\n");
}

/** Texto del rechazo: el motivo tal cual lo escribió el club y cómo seguir. */
export function textoRechazado(params: { nombre: string; motivo: string; club: string; url: string }) {
  return [
    `Hola ${params.nombre}:`,
    "",
    `Revisamos tu solicitud de alta en ${params.club} y por ahora no pudimos aprobarla.`,
    "",
    `Motivo: ${params.motivo}`,
    "",
    "Podés corregir lo que indica el motivo y volver a presentarla desde el mismo link:",
    params.url,
    "",
    `— ${params.club}`,
  ].join("\n");
}
