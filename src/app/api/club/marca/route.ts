import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CLUB_ID, getClub } from "@/lib/club";
import { brandSchema, IMAGE_KINDS, parseStoredBrand, type ImageKind } from "@/lib/brand";
import { validateBrandImage } from "@/lib/brand-image";
import { BRAND_IMAGE_COLUMN, getBrandView } from "@/lib/brand-db";
import { clientIp, fail, json } from "@/lib/http";

/**
 * Marca del club. `marca` reemplaza la configuración completa (el editor manda todo);
 * cada imagen es opcional: un data URL la reemplaza, `null` la quita, ausente la deja como está.
 */
const image = z.union([z.string().max(2_000_000), z.null()]).optional();
const Body = z.object({
  marca: brandSchema.optional(),
  logo: image,
  emblema: image,
  portada: image,
});

export async function GET() {
  try {
    await requireUser(["ADMIN"]);
    return json(await getBrandView());
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser(["ADMIN"]);
    const body = Body.parse(await req.json());
    await getClub();

    const data: Record<string, unknown> = {};
    const images: Partial<Record<ImageKind, "cargada" | "quitada">> = {};
    for (const kind of Object.keys(IMAGE_KINDS) as ImageKind[]) {
      const value = body[kind];
      if (value === undefined) continue;
      data[BRAND_IMAGE_COLUMN[kind]] = value === null ? null : validateBrandImage(kind, value);
      images[kind] = value === null ? "quitada" : "cargada";
    }
    if (body.marca) data.marca = body.marca;

    await prisma.$transaction(async (tx) => {
      const current = await tx.club.findUniqueOrThrow({ where: { id: CLUB_ID }, select: { marca: true } });
      await tx.club.update({ where: { id: CLUB_ID }, data: { ...data, marcaVersion: { increment: 1 } } });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "CLUB_BRAND_UPDATE",
          entity: "Club",
          entityId: CLUB_ID,
          ip: clientIp(req),
          // Sin los bytes de las imágenes: el libro registra qué cambió, no el archivo.
          payload: { antes: parseStoredBrand(current.marca), despues: body.marca ?? null, imagenes: images },
        },
      });
    });

    const view = await prisma.$queryRaw<{ marcaVersion: number }[]>`SELECT "marcaVersion" FROM "Club" WHERE id = ${CLUB_ID}`;
    return json({ ok: true, version: view[0]?.marcaVersion ?? 0 });
  } catch (error) {
    return fail(error);
  }
}
