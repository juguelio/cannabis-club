import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail, json, clientIp } from "@/lib/http";

const MAX_BYTES = 3 * 1024 * 1024;
const MIMES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Foto del producto para el catálogo. El cuerpo es la imagen cruda (no multipart):
 * así se controla el límite antes de tocar la base y no hace falta ninguna dependencia.
 * Equipo (ADMIN u OPERADOR) carga y reemplaza; cada cambio sube `fotoVersion` para invalidar la caché.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(["ADMIN", "OPERADOR"]);
    const { id } = await params;

    const mime = (req.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!MIMES.includes(mime)) return json({ error: "MIME_INVALIDO", message: "La foto tiene que ser JPG, PNG o WEBP." }, 400);

    const largo = Number(req.headers.get("content-length") ?? 0);
    if (largo > MAX_BYTES) return json({ error: "ARCHIVO_GRANDE", message: "La foto supera los 3 MB." }, 400);

    const bytes = Buffer.from(await req.arrayBuffer());
    if (!bytes.length) return json({ error: "ARCHIVO_VACIO", message: "La foto llegó vacía." }, 400);
    if (bytes.length > MAX_BYTES) return json({ error: "ARCHIVO_GRANDE", message: "La foto supera los 3 MB." }, 400);

    const strain = await prisma.strain.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!strain) return json({ error: "NO_ENCONTRADO", message: "Esa variedad no existe." }, 404);

    const actualizado = await prisma.$transaction(async (tx) => {
      const s = await tx.strain.update({
        where: { id },
        data: { fotoData: bytes, fotoMime: mime, fotoVersion: { increment: 1 } },
        select: { fotoVersion: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "STRAIN_PHOTO",
          entity: "Strain",
          entityId: id,
          ip: clientIp(req),
          payload: { name: strain.name, mime, bytes: bytes.length, version: s.fotoVersion },
        },
      });
      return s;
    });

    return json({ ok: true, version: actualizado.fotoVersion }, 201);
  } catch (error) {
    return fail(error);
  }
}

/** Quita la foto: el catálogo vuelve al recuadro provisorio. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(["ADMIN", "OPERADOR"]);
    const { id } = await params;
    const strain = await prisma.strain.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!strain) return json({ error: "NO_ENCONTRADO", message: "Esa variedad no existe." }, 404);

    await prisma.$transaction(async (tx) => {
      await tx.strain.update({ where: { id }, data: { fotoData: null, fotoMime: null, fotoVersion: { increment: 1 } } });
      await tx.auditLog.create({
        data: { actorId: user.id, action: "STRAIN_PHOTO_DELETE", entity: "Strain", entityId: id, ip: clientIp(req), payload: { name: strain.name } },
      });
    });

    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
