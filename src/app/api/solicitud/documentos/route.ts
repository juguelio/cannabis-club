import { prisma } from "@/lib/db";
import { route, searchParams } from "@/lib/api";
import { badRequest, forbidden, notFound, unauthorized } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/http";
import { leerSesionSolicitud } from "@/lib/onboarding";
import { DOC_MIMES, DOC_TIPOS, MAX_DOC_BYTES, encryptDoc, sha256, type DocTipo } from "@/lib/docs-crypto";

const esTipo = (v: string | null): v is DocTipo => !!v && (DOC_TIPOS as string[]).includes(v);

/**
 * Subida de un archivo del legajo. El cuerpo es el archivo crudo (no multipart):
 * así no hay dependencias y el límite se controla antes de tocar la base.
 * Se cifra acá: a la base sólo entra ciphertext.
 */
export const POST = route(async (req) => {
  const userId = await leerSesionSolicitud();
  if (!userId) throw unauthorized("Volvé a entrar con Google para continuar la solicitud.");

  const tipo = searchParams(req).get("tipo");
  if (!esTipo(tipo)) throw badRequest("TIPO_INVALIDO", "Tipo de documento desconocido.", { tipos: DOC_TIPOS });

  const mime = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!(DOC_MIMES as readonly string[]).includes(mime))
    throw badRequest("MIME_INVALIDO", "Sólo se aceptan fotos (JPG, PNG, WEBP) o PDF.");

  const largo = Number(req.headers.get("content-length") ?? 0);
  if (largo > MAX_DOC_BYTES) throw badRequest("ARCHIVO_GRANDE", "El archivo supera los 6 MB.");

  const bytes = Buffer.from(await req.arrayBuffer());
  if (!bytes.length) throw badRequest("ARCHIVO_VACIO", "El archivo llegó vacío.");
  if (bytes.length > MAX_DOC_BYTES) throw badRequest("ARCHIVO_GRANDE", "El archivo supera los 6 MB.");

  const solicitud = await prisma.accessRequest.findUnique({ where: { userId }, select: { id: true, status: true } });
  if (!solicitud) throw badRequest("SIN_SOLICITUD", "Primero completá los datos de la solicitud.");
  if (solicitud.status !== "PENDIENTE") throw forbidden("La solicitud ya está resuelta: no se pueden cambiar los archivos.");

  const { data, iv, tag } = encryptDoc(bytes);
  const huella = sha256(bytes);

  const previo = await prisma.accessDocument.findFirst({ where: { requestId: solicitud.id, tipo }, select: { id: true } });
  const doc = previo
    ? await prisma.accessDocument.update({
        where: { id: previo.id },
        data: { mime, size: bytes.length, sha256: huella, iv, tag, data, uploadedAt: new Date() },
        select: { id: true, tipo: true, mime: true, size: true, uploadedAt: true },
      })
    : await prisma.accessDocument.create({
        data: { requestId: solicitud.id, tipo, mime, size: bytes.length, sha256: huella, iv, tag, data },
        select: { id: true, tipo: true, mime: true, size: true, uploadedAt: true },
      });

  await audit({
    actorId: userId,
    action: "ACCESS_DOC_UPLOAD",
    entity: "AccessDocument",
    entityId: doc.id,
    ip: clientIp(req),
    payload: { tipo, size: doc.size, mime, sha256: huella },
  });

  return { documento: doc, reemplazado: !!previo };
});

/** Descarga: el dueño del expediente o un ADMIN. Cada apertura queda auditada. */
export const GET = route(async (req) => {
  const id = searchParams(req).get("id");
  if (!id) throw badRequest("FALTA_ID", "Falta el documento.");

  const doc = await prisma.accessDocument.findUnique({
    where: { id },
    select: { id: true, mime: true, size: true, iv: true, tag: true, data: true, tipo: true, request: { select: { userId: true, firstName: true, lastName: true } } },
  });
  if (!doc) throw notFound("Ese documento no existe.");

  const userId = await leerSesionSolicitud();
  let actorId: string | null = null;
  if (userId && userId === doc.request.userId) {
    actorId = userId;
  } else {
    const { requireUser } = await import("@/lib/auth");
    const admin = await requireUser(["ADMIN"]);
    actorId = admin.id;
    await audit({
      actorId,
      action: "ACCESS_DOC_VIEW",
      entity: "AccessDocument",
      entityId: doc.id,
      ip: clientIp(req),
      payload: { tipo: doc.tipo, solicitante: `${doc.request.firstName} ${doc.request.lastName}` },
    });
  }

  const { decryptDoc, docExtension } = await import("@/lib/docs-crypto");
  const plano = decryptDoc({ data: doc.data, iv: doc.iv, tag: doc.tag });
  const nombre = `${doc.tipo.toLowerCase()}-${doc.id}.${docExtension(doc.mime)}`;

  return new Response(new Uint8Array(plano), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Length": String(plano.length),
      "Content-Disposition": `inline; filename="${nombre}"`,
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex",
    },
  });
});
