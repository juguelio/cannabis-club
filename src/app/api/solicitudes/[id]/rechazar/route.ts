import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";
import { conflict, notFound, unprocessable } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/http";
import { validarRechazo } from "@/lib/access-request";
import { getBrandView } from "@/lib/brand-db";
import { enviarEmail, textoRechazado } from "@/lib/mailer";
import { plantillaEmail } from "@/lib/email-template";

const schema = z.object({ motivo: z.string().trim().min(1) });

/**
 * Rechazar la solicitud: la persona queda con su cuenta pendiente y puede volver a
 * presentarla. El motivo se le muestra tal cual, así que se exige que se entienda.
 */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const admin = await requireUser(["ADMIN"]);
  const { motivo } = await body(req, schema);

  const error = validarRechazo(motivo);
  if (error) throw unprocessable("MOTIVO_INVALIDO", error);

  const solicitud = await prisma.accessRequest.findUnique({
    where: { id },
    select: { id: true, status: true, userId: true, firstName: true, user: { select: { email: true } } },
  });
  if (!solicitud) throw notFound("Esa solicitud no existe.");
  if (solicitud.status === "APROBADA") throw conflict("YA_APROBADA", "Una solicitud aprobada no se rechaza: la cuenta ya es socia.");
  if (solicitud.status === "RECHAZADA") throw conflict("YA_RECHAZADA", "Esa solicitud ya estaba rechazada.");

  const actualizada = await prisma.accessRequest.update({
    where: { id },
    data: { status: "RECHAZADA", reviewedAt: new Date(), reviewedById: admin.id, rejectionReason: motivo },
    select: { id: true, status: true },
  });

  await audit({
    actorId: admin.id,
    action: "ACCESS_REQUEST_REJECT",
    entity: "AccessRequest",
    entityId: solicitud.id,
    ip: clientIp(req),
    payload: { motivo, email: solicitud.user.email },
  });

  const club = await getBrandView();
  const aviso = await enviarEmail({
    to: solicitud.user.email,
    subject: `Tu solicitud de alta en ${club.nombre}`,
    text: textoRechazado({
      nombre: solicitud.firstName,
      motivo,
      club: club.nombre,
      url: `${process.env.APP_BASE_URL ?? ""}/login`,
    }),
    html: plantillaEmail({
      titulo: "Falta algo en tu solicitud",
      copete: `Revisamos tu alta en ${club.nombre} y por ahora no pudimos aprobarla.`,
      destacado: { etiqueta: "Motivo", valor: motivo },
      parrafos: [
        `Hola ${solicitud.firstName}: podés corregir lo que indica el motivo y volver a presentar la solicitud desde el mismo link.`,
        "Si tenés dudas sobre qué falta, respondé este correo y te contestamos desde el club.",
      ],
      cta: { texto: "Volver a presentar la solicitud", url: `${process.env.APP_BASE_URL ?? ""}/login` },
      pie: [`Este aviso lo manda ${club.nombre} por tu solicitud de alta.`],
    }),
  });
  await audit({
    actorId: admin.id,
    action: "ACCESS_REJECTED_NOTICE",
    entity: "AccessRequest",
    entityId: solicitud.id,
    ip: clientIp(req),
    payload: { email: solicitud.user.email, enviado: aviso.enviado, motivo: aviso.motivo ?? null },
  });

  return { solicitud: actualizada, aviso: aviso.enviado ? "email" : "sin_email" };
});
