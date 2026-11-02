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
import { diasHastaVencer, enVentanaDeAviso, episodioDeVencimiento, textoAvisoVencimiento } from "./avisos-rules";

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
    const envio = await enviarEmail({
      to: socio.email,
      subject:
        socio.dias === 0
          ? "Tu REPROCANN vence hoy"
          : `Tu REPROCANN vence en ${socio.dias} ${socio.dias === 1 ? "día" : "días"}`,
      text: textoAvisoVencimiento({ nombre: socio.firstName, dias: socio.dias!, club: club.nombreCorto ?? club.nombre }),
    });
    if (!envio.enviado) {
      detalle.push({
        legajo: socio.legajo,
        dias: socio.dias!,
        estado: "error",
        motivo: envio.motivo === "sin_configurar" ? "el club no tiene correo saliente configurado" : envio.detalle,
      });
      continue;
    }
    await prisma.noticeLog.create({
      data: {
        memberId: socio.id,
        kind: "REPROCANN_POR_VENCER",
        channel: "EMAIL",
        byId: null,
        automatic: true,
        episode: episodio,
        note: `Aviso automático: vence en ${socio.dias} días`,
      },
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
