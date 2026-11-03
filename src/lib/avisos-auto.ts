/**
 * Aviso automático de vencimiento del REPROCANN.
 *
 * Corre por cron una vez al día: busca socios activos cuyo REPROCANN vence dentro del umbral del
 * club, manda el email y deja el asiento en `NoticeLog` (`automatic: true`). Si ya hay un aviso
 * para ese vencimiento, no repite: el episodio es la fecha, no el día en que corre el cron.
 *
 * Sin `RESEND_API_KEY` + `CLUB_MAIL_FROM` no se manda nada y se informa: el cron no inventa un
 * envío. Lo que sí queda es la cola de /avisos, que se calcula sola y el club ve al entrar.
 */
import { prisma } from "./db";
import { getClub } from "./club";
import { enviarEmail, mailerConfigured } from "./mailer";
import { plantillaEmail } from "./email-template";
import { copyAvisoVencimiento, diasHastaVencer, enVentanaDeAviso, episodioDeVencimiento, textoAvisoVencimiento } from "./avisos-rules";

export type EstadoAviso = "enviado" | "sin_email" | "ya_avisado" | "error";

export type ResultadoAvisos = {
  umbral: number;
  revisados: number;
  porVencer: number;
  enviados: number;
  yaAvisados: number;
  sinEmail: number;
  mailer: boolean;
  detalle: { legajo: number; dias: number; estado: EstadoAviso; motivo?: string }[];
};

export async function correrAvisosVencimiento(hoy = new Date()): Promise<ResultadoAvisos> {
  const club = await getClub();
  const umbral = club.avisoReprocannDias ?? 30;

  const socios = await prisma.member.findMany({
    where: { status: "ACTIVO", reprocannStatus: "VIGENTE", reprocannExpiresAt: { not: null } },
    select: { id: true, legajo: true, firstName: true, email: true, reprocannExpiresAt: true },
  });

  const candidatos = socios
    .map((s) => ({ ...s, dias: diasHastaVencer(s.reprocannExpiresAt, hoy) }))
    .filter((s) => enVentanaDeAviso(s.dias, umbral));

  const previos = await prisma.noticeLog.findMany({
    where: { kind: "REPROCANN_POR_VENCER", memberId: { in: candidatos.map((c) => c.id) } },
    select: { memberId: true, episode: true },
  });
  const yaAvisado = new Set(previos.map((p) => `${p.memberId}|${p.episode}`));

  const detalle: ResultadoAvisos["detalle"] = [];
  let enviados = 0;
  let yaAvisados = 0;
  let sinEmail = 0;
  const configurado = mailerConfigured();

  for (const socio of candidatos) {
    const episodio = episodioDeVencimiento(socio.reprocannExpiresAt!);
    if (yaAvisado.has(`${socio.id}|${episodio}`)) {
      yaAvisados += 1;
      detalle.push({ legajo: socio.legajo, dias: socio.dias!, estado: "ya_avisado" });
      continue;
    }
    if (!socio.email) {
      sinEmail += 1;
      detalle.push({ legajo: socio.legajo, dias: socio.dias!, estado: "sin_email", motivo: "el legajo no tiene email" });
      continue;
    }
    // Reclamo atómico del episodio: el índice único hace de candado, así el cron y una corrida
    // manual no mandan dos veces el mismo aviso. Si otro proceso lo tomó, P2002 y se sigue.
    let reclamo: { id: string };
    try {
      reclamo = await prisma.noticeLog.create({
        data: {
          memberId: socio.id,
          kind: "REPROCANN_POR_VENCER",
          channel: "EMAIL",
          byId: null,
          automatic: true,
          episode: episodio,
          note: "Envío en curso",
        },
        select: { id: true },
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        yaAvisados += 1;
        detalle.push({ legajo: socio.legajo, dias: socio.dias!, estado: "ya_avisado" });
        continue;
      }
      throw error;
    }

    // El copy vive en las reglas (probado sin base) y el layout en la plantilla: si mañana cambia
    // el tono según cuánto falta, cambia en un solo lugar.
    const copy = copyAvisoVencimiento({
      nombre: socio.firstName,
      dias: socio.dias!,
      club: club.nombreCorto ?? club.nombre,
      expira: socio.reprocannExpiresAt!,
    });
    const envio = await enviarEmail({
      to: socio.email,
      subject: copy.asunto,
      text: textoAvisoVencimiento({
        nombre: socio.firstName,
        dias: socio.dias!,
        club: club.nombreCorto ?? club.nombre,
        expira: socio.reprocannExpiresAt,
      }),
      html: plantillaEmail({
        titulo: copy.titulo,
        copete: copy.copete,
        destacado: copy.destacado,
        parrafos: copy.parrafos,
        cta: { texto: "Subir la credencial al portal", url: `${process.env.APP_BASE_URL ?? ""}/portal` },
        pie: [`Este aviso lo manda ${club.nombreCorto ?? club.nombre} porque tu credencial figura por vencer en el padrón.`],
      }),
    });
    if (!envio.enviado) {
      // No salió: se suelta el reclamo para que el próximo intento lo pueda tomar. Dejarlo
      // «avisado» sin correo sería mentir en la cola.
      await prisma.noticeLog.delete({ where: { id: reclamo.id } }).catch(() => undefined);
      detalle.push({
        legajo: socio.legajo,
        dias: socio.dias!,
        estado: "error",
        motivo: envio.motivo === "sin_configurar" ? "el club no tiene correo saliente configurado" : envio.detalle,
      });
      continue;
    }
    await prisma.noticeLog.update({
      where: { id: reclamo.id },
      data: { note: `Aviso automático: vence en ${socio.dias} días` },
    });
    await prisma.auditLog.create({
      data: {
        actorId: null,
        action: "NOTICE_SENT",
        entity: "Member",
        entityId: socio.id,
        payload: { automatico: true, canal: "EMAIL", motivo: "REPROCANN_POR_VENCER", dias: socio.dias, episodio },
      },
    });
    enviados += 1;
    detalle.push({ legajo: socio.legajo, dias: socio.dias!, estado: "enviado" });
  }

  return {
    umbral,
    revisados: socios.length,
    porVencer: candidatos.length,
    enviados,
    yaAvisados,
    sinEmail,
    mailer: configurado,
    detalle,
  };
}
