import { cache } from "react";
import { prisma } from "./db";
import { CLUB_ID } from "./club";
import { DEFAULT_BRAND, parseStoredBrand, siglaOf, type Brand, type ImageKind } from "./brand";

export type BrandView = {
  brand: Brand;
  /** Nombre para mostrar (corto si hay) y nombre legal completo. */
  nombre: string;
  nombreLegal: string;
  sigla: string;
  cuit: string | null;
  reprocannNumber: string | null;
  version: number;
  /** URL versionada de cada imagen, o null si no se cargó. */
  img: Record<ImageKind, string | null>;
};

type Row = {
  nombre: string;
  nombreCorto: string | null;
  cuit: string | null;
  reprocannNumber: string | null;
  marca: unknown;
  marcaVersion: number;
  hasLogo: boolean;
  hasEmblema: boolean;
  hasPortada: boolean;
};

/**
 * Marca del club para pintar cualquier pantalla. Una sola consulta por request (cache de React)
 * y sin traer los bytes de las imágenes: solo si existen.
 */
export const getBrandView = cache(async (): Promise<BrandView> => {
  const rows = await prisma
    .$queryRaw<Row[]>`
      SELECT nombre, "nombreCorto", cuit, "reprocannNumber", marca, "marcaVersion",
             ("marcaLogo" IS NOT NULL) AS "hasLogo",
             ("marcaEmblema" IS NOT NULL) AS "hasEmblema",
             ("marcaPortada" IS NOT NULL) AS "hasPortada"
      FROM "Club" WHERE id = ${CLUB_ID}`
    .catch(() => [] as Row[]);
  const row = rows[0];
  const brand = row ? parseStoredBrand(row.marca) : DEFAULT_BRAND;
  const nombreLegal = row?.nombre ?? "Club de cultivo";
  const nombre = row?.nombreCorto || nombreLegal;
  const v = row?.marcaVersion ?? 0;
  const url = (kind: ImageKind, has?: boolean) => (has ? `/api/marca/${kind}?v=${v}` : null);
  return {
    brand,
    nombre,
    nombreLegal,
    sigla: siglaOf(brand, nombre),
    cuit: row?.cuit ?? null,
    reprocannNumber: row?.reprocannNumber ?? null,
    version: v,
    img: { logo: url("logo", row?.hasLogo), emblema: url("emblema", row?.hasEmblema), portada: url("portada", row?.hasPortada) },
  };
});

const COLUMN: Record<ImageKind, "marcaLogo" | "marcaEmblema" | "marcaPortada"> = {
  logo: "marcaLogo",
  emblema: "marcaEmblema",
  portada: "marcaPortada",
};

export async function readBrandImage(kind: ImageKind): Promise<{ dataUrl: string | null; version: number }> {
  const col = COLUMN[kind];
  const club = await prisma.club.findUnique({ where: { id: CLUB_ID }, select: { [col]: true, marcaVersion: true } as Record<string, true> });
  const rec = club as unknown as Record<string, unknown> | null;
  return { dataUrl: (rec?.[col] as string | null) ?? null, version: (rec?.marcaVersion as number) ?? 0 };
}

export { COLUMN as BRAND_IMAGE_COLUMN };
