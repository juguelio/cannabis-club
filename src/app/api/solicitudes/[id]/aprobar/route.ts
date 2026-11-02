import { prisma } from "@/lib/db";
import { route } from "@/lib/api";
import { conflict, notFound, unprocessable } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/http";
import { decryptText } from "@/lib/docs-crypto";
import { AFFIDAVIT_VERSION, faltantesParaAprobar, legajoSiguiente } from "@/lib/access-request";
import { getBrandView } from "@/lib/brand-db";
import { enviarEmail, textoAprobado } from "@/lib/mailer";

/**
 * Aprobar la solicitud = crear el legajo. Es el único camino por el que una cuenta
 * nacida en Google llega a ser socio: el club revisó los documentos y decidió.
 */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const admin = await requireUser(["ADMIN"]);

  const solicitud = await prisma.accessRequest.findUnique({
    where: { id },
    select: {
      id: true, userId: true, status: true, docLast4: true, docHash: true, docNumberCipher: true,
      firstName: true, lastName: true, birthDate: true, phone: true, address: true, locality: true,
      reprocannNumber: true, reprocannExpiresAt: true, consumptionType: true, submittedAt: true, memberId: true,
      documents: { select: { tipo: true } },
      user: { select: { id: true, email: true, active: true, memberId: true } },
    },
  });
  if (!solicitud) throw notFound("Esa solicitud no existe.");
  if (solicitud.user.memberId) throw conflict("YA_TIENE_LEGAJO", "Esa persona ya tiene legajo.");

  const faltan = faltantesParaAprobar({
    status: solicitud.status,
    tiposCargados: solicitud.documents.map((d) => d.tipo),
    docLast4: solicitud.docLast4,
  });
  if (faltan.length) throw unprocessable("SOLICITUD_INCOMPLETA", "No se puede aprobar todavía.", faltan);

  // Reclamo de un legajo del padrón (socios que vinieron de la planilla): no se crea otro, se completa el
  // que existe. El email es la llave, y el club ya revisó los documentos antes de aprobar.
  const reclamado = solicitud.memberId
    ? await prisma.member.findUnique({
        where: { id: solicitud.memberId },
        select: { id: true, legajo: true, admittedAt: true, notes: true },
      })
    : null;

  const legajo = reclamado
    ? reclamado.legajo
    : legajoSiguiente((await prisma.member.findMany({ select: { legajo: true } })).map((m) => m.legajo));

  const dni = solicitud.docNumberCipher ? decryptText(solicitud.docNumberCipher) : null;

  const resultado = await prisma.$transaction(async (tx) => {
    const datosLegajo = {
        firstName: solicitud.firstName,
        lastName: solicitud.lastName,
        birthDate: solicitud.birthDate,
        phone: solicitud.phone,
        address: solicitud.address,
        email: solicitud.user.email,
        docHash: solicitud.docHash,
        docLast4: solicitud.docLast4,
        docVerifiedAt: new Date(),
        status: "ACTIVO" as const,
        reprocannNumber: solicitud.reprocannNumber,
        reprocannStatus: "VIGENTE" as const,
        reprocannExpiresAt: solicitud.reprocannExpiresAt,
        consumptionType: solicitud.consumptionType,
        consentSignedAt: solicitud.submittedAt,
        consentVersion: AFFIDAVIT_VERSION,
      };

    // El club aprobó mirando los mismos documentos que mira en la re-validación: el legajo queda validado
    // y puede reservar sin pasar por el trámite otra vez.
    const member = reclamado
      ? await tx.member.update({
          where: { id: reclamado.id },
          data: {
            ...datosLegajo,
            admittedAt: reclamado.admittedAt ?? new Date(),
            verificationStatus: "VERIFICADO",
            verificationAt: new Date(),
            notes: [reclamado.notes, "Acceso reclamado desde el portal (ya estaba en el padrón)."].filter(Boolean).join("\n"),
          },
          select: { id: true, legajo: true },
        })
      : await tx.member.create({
        data: {
          ...datosLegajo,
          legajo,
          admittedAt: new Date(),
          notes: solicitud.locality ? `Solicitud web · ${solicitud.locality}` : "Solicitud web",
        },
      select: { id: true, legajo: true },
    });

    await tx.user.update({
      where: { id: solicitud.user.id },
      data: {
        active: true,
        memberId: member.id,
        role: "SOCIO",
        name: `${solicitud.firstName} ${solicitud.lastName}`.trim(),
      },
    });

    await tx.accessRequest.update({
      where: { id: solicitud.id },
      data: { status: "APROBADA", reviewedAt: new Date(), reviewedById: admin.id, memberId: member.id },
    });

    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: "ACCESS_REQUEST_APPROVE",
        entity: "AccessRequest",
        entityId: solicitud.id,
        payload: { legajo: member.legajo, email: solicitud.user.email, docNumberDescifrado: !!dni },
      },
    });

    return member;
  });

  // Aviso por email: si no hay proveedor configurado, el alta igual quedó hecha.
  const club = await getBrandView();
  const aviso = await enviarEmail({
    to: solicitud.user.email,
    subject: `Tu alta en ${club.nombre} está aprobada`,
    text: textoAprobado({
      nombre: solicitud.firstName,
      legajo: resultado.legajo,
      club: club.nombre,
      url: `${process.env.APP_BASE_URL ?? ""}/login`,
    }),
  });
  await audit({
    actorId: admin.id,
    action: "ACCESS_APPROVED_NOTICE",
    entity: "AccessRequest",
    entityId: solicitud.id,
    ip: clientIp(req),
    payload: { email: solicitud.user.email, enviado: aviso.enviado, motivo: aviso.motivo ?? null },
  });

  return {
    socio: { id: resultado.id, legajo: resultado.legajo, email: solicitud.user.email },
    mensaje: reclamado
      ? `Legajo ${resultado.legajo} reclamado y validado. La cuenta ya puede entrar al portal.`
      : `Legajo ${resultado.legajo} creado. La cuenta ya puede entrar al portal.`,
    aviso: aviso.enviado ? "email" : "sin_email",
  };
});
