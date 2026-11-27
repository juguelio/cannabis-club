import sharp from "sharp";
import { prisma } from "./db";
import { requireUser } from "./auth";
import { badRequest, notFound } from "./errors";
import { clientIp } from "./http";
import { limiteArchivoLegajo } from "./archivo-legajo";

export async function guardarFotoLote(req: Request, batchId: string, fotoId?: string) {
  const actor = await requireUser(["ADMIN"]);
  const mime = req.headers.get("content-type")?.split(";")[0].trim();
  if (!mime || !["image/jpeg", "image/png", "image/webp"].includes(mime))
    throw badRequest("FORMATO_INVALIDO", "Elegí una foto JPG, PNG o WEBP.");
  const grande = () => badRequest("ARCHIVO_GRANDE", "La foto supera los 4 MB. Elegí una versión más chica.");
  if (Number(req.headers.get("content-length")) > limiteArchivoLegajo) throw grande();
  const input = Buffer.from(await req.arrayBuffer());
  if (!input.length) throw badRequest("ARCHIVO_VACIO", "La foto está vacía.");
  if (input.length > limiteArchivoLegajo) throw grande();
  let data: Uint8Array<ArrayBuffer>;
  try {
    const img = sharp(input, { limitInputPixels: 50000000 });
    if (mime !== `image/${(await img.metadata()).format}`) throw new Error("formato");
    data = new Uint8Array(await img.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer());
  } catch {
    throw badRequest("IMAGEN_INVALIDA", "No se pudo leer la imagen. Elegí una foto JPG, PNG o WEBP válida.");
  }
  return prisma.$transaction(async tx => {
    if (!await tx.batch.findUnique({ where: { id: batchId }, select: { id: true } })) throw notFound("Lote inexistente.");
    let id = fotoId;
    if (id) {
      const actualizado = await tx.batchPhoto.updateMany({ where: { id, batchId }, data: { data } });
      if (!actualizado.count) throw notFound("La foto no pertenece a este lote.");
    } else {
      const foto = await tx.batchPhoto.create({ data: { batchId, data }, select: { id: true } });
      id = foto.id;
    }
    await tx.auditLog.create({ data: { action: "BATCH_PHOTO_UPLOAD", entity: "Batch", entityId: batchId,
      actorId: actor.id, ip: clientIp(req), payload: { fotoId: id, reemplazo: !!fotoId } } });
    return { id };
  });
}
