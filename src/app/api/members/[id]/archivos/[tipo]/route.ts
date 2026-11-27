import sharp from "sharp";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";
import { clientIp } from "@/lib/http";
import { audit } from "@/lib/audit";
import { archivosLegajo, limiteArchivoLegajo } from "@/lib/archivo-legajo";
import { decryptDoc, encryptDoc, sha256 } from "@/lib/docs-crypto";
import { cabecerasDeArchivo, nombreDeArchivo } from "@/lib/file-headers";

type Params = { id: string; tipo: string };

export const POST = route<Params>(async (req, { id, tipo }) => {
  const actor = await requireUser(["ADMIN"]);
  if (!Object.hasOwn(archivosLegajo, tipo)) throw notFound("Tipo de archivo inexistente.");
  const grande = () => badRequest("ARCHIVO_GRANDE", "El archivo supera los 4 MB. Elegí una versión más chica.");
  if (Number(req.headers.get("content-length")) > limiteArchivoLegajo) throw grande();
  const mime = req.headers.get("content-type")?.split(";")[0].trim() ?? "";
  const pdf = mime === "application/pdf" && tipo !== "PERFIL";
  if (!pdf && !["image/jpeg", "image/png", "image/webp"].includes(mime))
    throw badRequest("FORMATO_INVALIDO", tipo === "PERFIL" ? "Elegí una foto JPG, PNG o WEBP." : "Elegí un JPG, PNG, WEBP o PDF.");
  const bytes = Buffer.from(await req.arrayBuffer());
  if (!bytes.length) throw badRequest("ARCHIVO_VACIO", "El archivo está vacío.");
  if (bytes.length > limiteArchivoLegajo) throw grande();

  let contenido: Buffer = bytes;
  let mimeGuardado = mime;
  if (pdf) {
    if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw badRequest("PDF_INVALIDO", "El archivo no es un PDF válido.");
  } else {
    try {
      const imagen = sharp(bytes, { limitInputPixels: 50000000 });
      const { format } = await imagen.metadata();
      if (mime !== `image/${format}`) throw new Error("formato");
      if (tipo === "PERFIL") {
        contenido = await imagen.rotate().resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).webp().toBuffer();
        mimeGuardado = "image/webp";
      }
    } catch {
      throw badRequest("IMAGEN_INVALIDA", "No se pudo leer esa foto. Elegí una imagen JPG, PNG o WEBP válida.");
    }
  }
  const archivo = { ...encryptDoc(contenido), mime: mimeGuardado, size: contenido.length, sha256: sha256(contenido), uploadedAt: new Date() };
  await prisma.$transaction(async tx => {
    const socio = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Member" WHERE id = ${id} FOR UPDATE`;
    if (!socio.length) throw notFound("Socio inexistente.");
    await tx.memberFile.upsert({ where: { memberId_tipo: { memberId: id, tipo } },
      create: { memberId: id, tipo, ...archivo }, update: archivo, select: { tipo: true } });
    if (tipo !== "PERFIL") {
      const revision = await tx.memberVerification.findFirst({
        where: { memberId: id, status: "EN_REVISION", supersededAt: null }, orderBy: { submittedAt: "desc" }, select: { id: true },
      });
      if (revision) {
        const where = { verificationId: revision.id, tipo };
        const prev = await tx.verificationDocument.updateMany({ where, data: archivo });
        if (!prev.count) await tx.verificationDocument.create({ data: { ...where, ...archivo }, select: { id: true } });
      }
    }
    await tx.auditLog.create({ data: { action: "MEMBER_FILE_UPLOAD", entity: "Member", entityId: id,
      actorId: actor.id, ip: clientIp(req), payload: { tipo, sha256: archivo.sha256 } } });
  });
  return { ok: true };
});

export const GET = route<Params>(async (req, { id, tipo }) => {
  const actor = await requireUser(tipo === "PERFIL" ? ["ADMIN", "OPERADOR", "DISPENSADOR"] : ["ADMIN"]);
  if (!Object.hasOwn(archivosLegajo, tipo)) throw notFound();
  const doc = await prisma.memberFile.findUnique({ where: { memberId_tipo: { memberId: id, tipo } } });
  if (!doc) throw notFound("Archivo inexistente.");
  const bytes = decryptDoc(doc);
  if (tipo !== "PERFIL") await audit({ actorId: actor.id, action: "ACCESS_DOC_VIEW", entity: "MemberFile",
    entityId: id, ip: clientIp(req), payload: { tipo } });
  return new Response(new Uint8Array(bytes), { headers: cabecerasDeArchivo({
    mime: doc.mime, bytes: bytes.length, nombre: nombreDeArchivo(tipo.toLowerCase(), doc.mime),
  }) });
});
