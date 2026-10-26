import { prisma } from "@/lib/db";
import { route } from "@/lib/api";
import { conflict, notFound, unprocessable } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { clientIp } from "@/lib/http";
import { decryptText } from "@/lib/docs-crypto";
import { AFFIDAVIT_VERSION, faltantesParaAprobar, legajoSiguiente } from "@/lib/access-request";

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
  if (solicitud.memberId || solicitud.user.memberId) throw conflict("YA_TIENE_LEGAJO", "Esa persona ya tiene legajo.");

  const faltan = faltantesParaAprobar({
    status: solicitud.status,
    tiposCargados: solicitud.documents.map((d) => d.tipo),
    docLast4: solicitud.docLast4,
  });
  if (faltan.length) throw unprocessable("SOLICITUD_INCOMPLETA", "No se puede aprobar todavía.", faltan);

  const legajos = await prisma.member.findMany({ select: { legajo: true } });
  const legajo = legajoSiguiente(legajos.map((m) => m.legajo));

  const dni = solicitud.docNumberCipher ? decryptText(solicitud.docNumberCipher) : null;

  const resultado = await prisma.$transaction(async (tx) => {
    const member = await tx.member.create({
      data: {
        legajo,
        firstName: solicitud.firstName,
        lastName: solicitud.lastName,
        birthDate: solicitud.birthDate,
        phone: solicitud.phone,
        address: solicitud.address,
        email: solicitud.user.email,
        docHash: solicitud.docHash,
        docLast4: solicitud.docLast4,
        docVerifiedAt: new Date(),
        status: "ACTIVO",
        admittedAt: new Date(),
        reprocannNumber: solicitud.reprocannNumber,
        reprocannStatus: "VIGENTE",
        reprocannExpiresAt: solicitud.reprocannExpiresAt,
        consumptionType: solicitud.consumptionType,
        consentSignedAt: solicitud.submittedAt,
        consentVersion: AFFIDAVIT_VERSION,
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

  return {
    socio: { id: resultado.id, legajo: resultado.legajo, email: solicitud.user.email },
    mensaje: `Legajo ${resultado.legajo} creado. La cuenta ya puede entrar al portal.`,
    ip: clientIp(req),
  };
});
