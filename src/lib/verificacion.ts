import { cache } from "react";
/**
 * Re-validación de legajos que ya existen: el socio prueba DNI y REPROCANN, el club mira.
 *
 * Dos mitades, igual que el alta: el socio presenta (datos + tres archivos cifrados) y el club
 * revisa. Nada se aplica a la ficha hasta que una persona aprueba, y aprobar es lo único que
 * cambia `docHash`, `birthDate` y el REPROCANN del legajo — la fuente es el documento, no el dicho.
 *
 * Un rechazo no borra: deja el expediente con su motivo y el socio presenta uno nuevo que lo
 * supersede. Un legajo VERIFICADO no se vuelve a presentar por acá.
 */
import { prisma } from "./db";
import { audit } from "./audit";
import { docHash, docLast4 } from "./privacy";
import { encryptDoc, encryptText, sha256 } from "./docs-crypto";
import { badRequest, conflict, notFound } from "./errors";
import { getClub } from "./club";
import { limitsFromClub } from "./club";
import {
  faltanDocumentos,
  textoFaltantes,
  validarDeclaracion,
  validarDomicilio,
  DOCS_OBLIGATORIOS,
} from "./verificacion-rules";

export type Presentacion = {
  dni: string;
  nacimiento: string;
  reprocann: string;
  vence: string;
  /** Cómo recibe y a dónde. Se pide acá porque es el único momento en que el socio ya está escribiendo. */
  entrega: "RETIRO" | "ENVIO" | "SUCURSAL";
  direccion?: string;
  localidad?: string;
  provincia?: string;
  codigoPostal?: string;
};

const DOCS_SELECT = { id: true, tipo: true, mime: true, size: true, sha256: true, uploadedAt: true } as const;

/** Una lectura por request (cache de React). */
export const verificacionDelSocio = cache(verificacionDelSocioLeer);

async function verificacionDelSocioLeer(memberId: string) {
  const [member, ultima] = await Promise.all([
    prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        legajo: true,
        verificationStatus: true,
        verificationAt: true,
        birthDate: true,
        docLast4: true,
        /// Lo que el socio contestó cuando le preguntamos si tiene REPROCANN (ver `reprocann-entrada`).
        reprocannDeclaracion: true,
        reprocannStatus: true,
        reprocannExpiresAt: true,
      },
    }),
    prisma.memberVerification.findFirst({
      where: { memberId },
      orderBy: { submittedAt: "desc" },
      include: { documents: { select: DOCS_SELECT } },
    }),
  ]);
  if (!member) throw notFound("Socio inexistente");
  const tipos = ultima?.documents.map((d) => d.tipo) ?? [];
  return {
    member,
    ultima,
    faltan: faltanDocumentos(tipos),
    faltantesTexto: textoFaltantes(faltanDocumentos(tipos)),
  };
}

/** Paso 1 del trámite: los datos declarados. Los archivos se suben después, uno por uno. */
export async function presentarVerificacion(input: Presentacion & { memberId: string; actorId: string; ip?: string | null }) {
  const club = await getClub();
  const config = limitsFromClub(club);
  const res = validarDeclaracion({
    dni: input.dni,
    nacimiento: input.nacimiento,
    reprocann: input.reprocann,
    vence: input.vence,
    edadMinima: config.edadMinima,
  });
  if (!res.ok) throw badRequest(res.problema.codigo, res.problema.mensaje, [res.problema]);

  const dom = validarDomicilio(input);
  if (!dom.ok) throw badRequest(dom.problema.codigo, dom.problema.mensaje, [dom.problema]);

  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: { id: true, verificationStatus: true, legajo: true },
  });
  if (!member) throw notFound("Socio inexistente");
  if (member.verificationStatus === "VERIFICADO")
    throw conflict(
      "YA_VERIFICADO",
      "Tu legajo ya está validado. Si cambió el REPROCANN o el domicilio, escribile al club.",
    );

  const huella = docHash(res.datos.dni);
  const enOtroLegajo = await prisma.member.findFirst({
    where: { docHash: huella, id: { not: member.id } },
    select: { legajo: true },
  });
  if (enOtroLegajo)
    throw conflict("DOC_EN_USO", "Ese DNI ya está en otro legajo del club. Escribile al club para unificarlo.");

  const anterior = await prisma.memberVerification.findFirst({
    where: { memberId: member.id },
    orderBy: { submittedAt: "desc" },
    select: { id: true, status: true },
  });

  const creada = await prisma.$transaction(async (tx) => {
    // Una presentación nueva reemplaza la anterior: el expediente viejo no se edita, se supersede.
    if (anterior)
      await tx.memberVerification.update({
        where: { id: anterior.id },
        data: { status: "RECHAZADO", reviewedAt: new Date(), rejectionReason: "Reemplazada por una presentación nueva del socio." },
      });
    const nueva = await tx.memberVerification.create({
      data: {
        memberId: member.id,
        status: "EN_REVISION",
        docNumberCipher: encryptText(res.datos.dni),
        docHash: huella,
        docLast4: docLast4(res.datos.dni),
        birthDate: res.datos.nacimiento,
        reprocannNumber: input.reprocann.trim(),
        reprocannExpiresAt: res.datos.vence,
        deliveryMode: dom.datos.entrega,
        address: dom.datos.address,
        locality: dom.datos.locality,
        province: dom.datos.province,
        postalCode: dom.datos.postalCode,
        supersedesId: anterior?.id ?? null,
      },
      select: { id: true },
    });
    await tx.member.update({ where: { id: member.id }, data: { verificationStatus: "EN_REVISION" } });
    return nueva;
  });

  await audit({
    actorId: input.actorId,
    action: "MEMBER_VERIFICATION_SUBMIT",
    entity: "MemberVerification",
    entityId: creada.id,
    ip: input.ip ?? null,
    payload: { legajo: member.legajo, vence: input.vence, supersede: anterior?.id ?? null },
  });

  return { id: creada.id };
}

/** Paso 2: los archivos. Se cifran antes de tocar la base; reemplazan al mismo tipo, no se acumulan. */
export async function subirDocumentoVerificacion(input: {
  memberId: string;
  tipo: string;
  mime: string;
  bytes: Buffer;
  actorId: string;
  ip?: string | null;
}) {
  const verificacion = await prisma.memberVerification.findFirst({
    where: { memberId: input.memberId },
    orderBy: { submittedAt: "desc" },
    select: { id: true, status: true },
  });
  if (!verificacion) throw badRequest("SIN_PRESENTACION", "Primero completá tus datos y después subí los archivos.");
  if (verificacion.status !== "EN_REVISION")
    throw conflict("PRESENTACION_CERRADA", "Esta presentación ya está resuelta: no se pueden cambiar los archivos.");

  const { data, iv, tag } = encryptDoc(input.bytes);
  const huella = sha256(input.bytes);
  const previo = await prisma.verificationDocument.findFirst({
    where: { verificationId: verificacion.id, tipo: input.tipo },
    select: { id: true },
  });
  const base = { mime: input.mime, size: input.bytes.length, sha256: huella, iv, tag, data, uploadedAt: new Date() };
  const doc = previo
    ? await prisma.verificationDocument.update({ where: { id: previo.id }, data: base, select: DOCS_SELECT })
    : await prisma.verificationDocument.create({ data: { ...base, verificationId: verificacion.id, tipo: input.tipo }, select: DOCS_SELECT });

  await audit({
    actorId: input.actorId,
    action: "ACCESS_DOC_UPLOAD",
    entity: "VerificationDocument",
    entityId: doc.id,
    ip: input.ip ?? null,
    payload: { tipo: input.tipo, size: doc.size, mime: input.mime, sha256: huella, verificacion: verificacion.id },
  });

  return doc;
}

/** La cola del club: lo presentado esperando revisión, más quiénes no empezaron. */
export async function colaVerificaciones() {
  const [revision, sinPresentar] = await Promise.all([
    prisma.memberVerification.findMany({
      where: { status: "EN_REVISION" },
      orderBy: { submittedAt: "asc" },
      include: {
        member: { select: { id: true, legajo: true, firstName: true, lastName: true, email: true, phone: true } },
        documents: { select: DOCS_SELECT },
      },
    }),
    prisma.member.findMany({
      where: { status: { in: ["ACTIVO", "PENDIENTE"] }, verificationStatus: { in: ["PENDIENTE", "RECHAZADO"] } },
      orderBy: { legajo: "asc" },
      select: { id: true, legajo: true, firstName: true, lastName: true, email: true, verificationStatus: true },
    }),
  ]);
  return { revision, sinPresentar };
}

export async function revisionDe(id: string) {
  const rev = await prisma.memberVerification.findUnique({
    where: { id },
    include: {
      member: { select: { id: true, legajo: true, firstName: true, lastName: true, email: true, phone: true, address: true, birthDate: true, docLast4: true, reprocannStatus: true, reprocannExpiresAt: true, verificationStatus: true } },
      documents: { select: DOCS_SELECT },
      reviewedBy: { select: { name: true } },
    },
  });
  if (!rev) throw notFound("Revisión inexistente");
  const tipos = rev.documents.map((d) => d.tipo);
  return { rev, faltan: faltanDocumentos(tipos), faltantesTexto: textoFaltantes(faltanDocumentos(tipos)) };
}

/** Abrir un documento deja asiento: son datos sensibles y el club tiene que poder rendir cuentas. */
export async function abrirDocumentoVerificacion(input: { verificationId: string; docId: string; actorId: string; ip?: string | null }) {
  const doc = await prisma.verificationDocument.findFirst({
    where: { id: input.docId, verificationId: input.verificationId },
    select: { id: true, mime: true, data: true, iv: true, tag: true, tipo: true },
  });
  if (!doc) throw notFound("Documento inexistente");
  await audit({
    actorId: input.actorId,
    action: "ACCESS_DOC_VIEW",
    entity: "VerificationDocument",
    entityId: doc.id,
    ip: input.ip ?? null,
    payload: { tipo: doc.tipo, verificacion: input.verificationId },
  });
  return doc;
}

/** Aprobar aplica el documento a la ficha: es el único lugar donde el legajo cambia de datos. */
export async function aprobarVerificacion(input: { id: string; actorId: string; ip?: string | null }) {
  const { rev, faltan, faltantesTexto } = await revisionDe(input.id);
  if (rev.status !== "EN_REVISION") throw conflict("YA_REVISADA", "Esta presentación ya fue revisada.");
  if (faltan.length > 0) throw badRequest("DOCS_FALTANTES", faltantesTexto);

  const enOtroLegajo = await prisma.member.findFirst({
    where: { docHash: rev.docHash, id: { not: rev.memberId } },
    select: { legajo: true },
  });
  if (enOtroLegajo)
    throw conflict("DOC_EN_USO", `Ese DNI ya está en el legajo ${enOtroLegajo.legajo}. Unificá antes de aprobar.`);

  const hoy = new Date();
  const vence = rev.reprocannExpiresAt;
  const vigente = vence.getTime() >= Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());

  await prisma.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: rev.memberId },
      data: {
        docHash: rev.docHash,
        docLast4: rev.docLast4,
        docVerifiedAt: hoy,
        birthDate: rev.birthDate,
        reprocannNumber: rev.reprocannNumber,
        reprocannExpiresAt: vence,
        reprocannStatus: vigente ? "VIGENTE" : "VENCIDO",
        // El domicilio también: es lo que habilita el envío, y hasta acá vivía sólo en el expediente.
        address: rev.address ?? undefined,
        locality: rev.locality ?? undefined,
        province: rev.province ?? undefined,
        postalCode: rev.postalCode ?? undefined,
        verificationStatus: "VERIFICADO",
        verificationAt: hoy,
      },
    });
    await tx.memberVerification.update({
      where: { id: rev.id },
      data: { status: "VERIFICADO", reviewedAt: hoy, reviewedById: input.actorId },
    });
  });

  await audit({
    actorId: input.actorId,
    action: "MEMBER_VERIFICATION_APPROVE",
    entity: "Member",
    entityId: rev.memberId,
    ip: input.ip ?? null,
    payload: { verificacion: rev.id, legajo: rev.member.legajo, vence: rev.reprocannExpiresAt.toISOString().slice(0, 10), vigente },
  });

  return { legajo: rev.member.legajo, vigente };
}

export async function rechazarVerificacion(input: { id: string; actorId: string; motivo: string; ip?: string | null }) {
  const motivo = input.motivo.trim();
  if (motivo.length < 10)
    throw badRequest("MOTIVO_CORTO", "Escribí el motivo (al menos 10 caracteres): el socio lo va a leer.");
  const { rev } = await revisionDe(input.id);
  if (rev.status !== "EN_REVISION") throw conflict("YA_REVISADA", "Esta presentación ya fue revisada.");

  await prisma.$transaction(async (tx) => {
    await tx.memberVerification.update({
      where: { id: rev.id },
      data: { status: "RECHAZADO", reviewedAt: new Date(), reviewedById: input.actorId, rejectionReason: motivo },
    });
    await tx.member.update({ where: { id: rev.memberId }, data: { verificationStatus: "RECHAZADO" } });
  });

  await audit({
    actorId: input.actorId,
    action: "MEMBER_VERIFICATION_REJECT",
    entity: "Member",
    entityId: rev.memberId,
    ip: input.ip ?? null,
    payload: { verificacion: rev.id, legajo: rev.member.legajo, motivo },
  });

  return { legajo: rev.member.legajo };
}

export { DOCS_OBLIGATORIOS };
