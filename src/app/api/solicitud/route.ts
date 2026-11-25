import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";
import { badRequest, conflict, unauthorized } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/http";
import { leerSesionSolicitud } from "@/lib/onboarding";
import { docFingerprint } from "@/lib/privacy";
import { encryptText } from "@/lib/docs-crypto";
import {
  AFFIDAVIT_VERSION,
  CONFIRMAR_DECLARACION,
  FALTA_NACIMIENTO,
  FALTA_VENCIMIENTO,
  esDocumentoDelMismoLegajo,
  esReclamoDeLegajo,
  validarSolicitud,
} from "@/lib/access-request";

const schema = z.object({
  firstName: z.string().trim().default(""),
  lastName: z.string().trim().default(""),
  birthDate: z.string({ error: FALTA_NACIMIENTO }).default(""),
  phone: z.string().trim().default(""),
  address: z.string().trim().default(""),
  locality: z.string().trim().optional().nullable(),
  // El código postal no se pide acá: `AccessRequest` no lo guarda y el domicilio completo se declara
  // en el paso de validación (`MemberVerification`), que es el que lo lleva al legajo.
  docNumber: z.string().trim().default(""),
  reprocannNumber: z.string().trim().default(""),
  reprocannExpiresAt: z.string({ error: FALTA_VENCIMIENTO }).default(""),
  consumptionType: z.enum(["LUDICO", "TERAPEUTICO"]).optional(),
  affidavitAccepted: z.boolean({ error: CONFIRMAR_DECLARACION }).default(false),
});

const TIPOS = ["DNI_FRENTE", "DNI_DORSO", "REPROCANN"];

/** Estado del expediente propio (se entra con la cookie de onboarding, no con la sesión). */
export const GET = route(async () => {
  const userId = await leerSesionSolicitud();
  if (!userId) throw unauthorized("Volvé a entrar con Google para continuar la solicitud.");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, active: true } });
  if (!user) throw unauthorized("La cuenta ya no existe.");

  const request = await prisma.accessRequest.findUnique({
    where: { userId },
    select: {
      id: true, status: true, firstName: true, lastName: true, submittedAt: true, reviewedAt: true, rejectionReason: true,
      reprocannNumber: true, reprocannExpiresAt: true, memberId: true,
      documents: { select: { id: true, tipo: true, mime: true, size: true, uploadedAt: true } },
    },
  });

  return {
    email: user.email,
    aprobado: user.active,
    solicitud: request
      ? {
          ...request,
          faltantes: TIPOS.filter((t) => !request.documents.some((d) => d.tipo === t)),
        }
      : null,
  };
});

/** Presenta (o vuelve a presentar, si fue rechazada) la solicitud. */
export const POST = route(async (req) => {
  const userId = await leerSesionSolicitud();
  if (!userId) throw unauthorized("Volvé a entrar con Google para continuar la solicitud.");

  const input = await body(req, schema);
  const errores = validarSolicitud(input);
  if (errores.length) throw badRequest("SOLICITUD_INCOMPLETA", "Revisá los datos de la solicitud.", errores);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, active: true } });
  if (!user) throw unauthorized("La cuenta ya no existe.");
  if (user.active) throw conflict("YA_ES_SOCIO", "Tu cuenta ya está habilitada.");

  const previa = await prisma.accessRequest.findUnique({ where: { userId }, select: { id: true, status: true } });
  if (previa && previa.status !== "RECHAZADA")
    throw conflict("YA_PRESENTADA", "Ya presentaste la solicitud: está en revisión.");

  // Reclamo de un legajo del padrón: el email ya está en la ficha, así que la solicitud se cuelga de ese
  // legajo en vez de crear otro cuando el club apruebe.
  const padronCandidato = await prisma.member.findFirst({
    where: { email: { equals: user.email, mode: "insensitive" } },
    select: { id: true, legajo: true, email: true, user: { select: { id: true } } },
  });
  const padron =
    padronCandidato && esReclamoDeLegajo({ emailPadron: padronCandidato.email, emailCuenta: user.email, yaTieneCuenta: !!padronCandidato.user })
      ? padronCandidato
      : null;

  const huella = docFingerprint(input.docNumber);
  const duplicado = await prisma.member.findUnique({ where: { docHash: huella.docHash }, select: { legajo: true } });
  // Que el documento ya esté en el legajo que se reclama no es un duplicado: es el mismo socio.
  const esSuPropioLegajo = esDocumentoDelMismoLegajo({
    legajoDelDocumento: duplicado?.legajo ?? null,
    legajoReclamado: padron?.legajo ?? null,
  });
  if (duplicado && !esSuPropioLegajo) throw conflict("DOCUMENTO_YA_REGISTRADO", "Ese documento ya tiene legajo en el club.", { campo: "docNumber" });

  // El payload se tipa contra el modelo: una clave que `AccessRequest` no tiene no compila y no
  // llega a producción como 500 «Error interno» (pasó con `postalCode`, que vive en la verificación).
  const datos = {
    firstName: input.firstName,
    lastName: input.lastName,
    birthDate: new Date(`${input.birthDate}T00:00:00Z`),
    phone: input.phone,
    address: input.address,
    locality: input.locality ?? null,
    docHash: huella.docHash,
    docLast4: huella.docLast4,
    docNumberCipher: encryptText(input.docNumber.replace(/\D/g, "")),
    reprocannNumber: input.reprocannNumber.trim(),
    reprocannExpiresAt: new Date(`${input.reprocannExpiresAt}T00:00:00Z`),
    consumptionType: input.consumptionType ?? "LUDICO",
    affidavitAccepted: true,
    affidavitVersion: AFFIDAVIT_VERSION,
    status: "PENDIENTE" as const,
    memberId: padron?.id ?? null,
    submittedAt: new Date(),
    reviewedAt: null,
    reviewedById: null,
    rejectionReason: null,
  } satisfies Omit<Prisma.AccessRequestUncheckedCreateInput, "userId">;

  const solicitud = previa
    ? await prisma.accessRequest.update({ where: { id: previa.id }, data: datos, select: { id: true, status: true } })
    : await prisma.accessRequest.create({ data: { userId, ...datos }, select: { id: true, status: true } });

  await audit({
    actorId: userId,
    action: previa ? "ACCESS_REQUEST_RESUBMIT" : "ACCESS_REQUEST_SUBMIT",
    entity: "AccessRequest",
    entityId: solicitud.id,
    ip: clientIp(req),
    payload: { email: user.email, docLast4: huella.docLast4, legajoReclamado: padron?.legajo ?? null },
  });

  return { solicitud };
});
