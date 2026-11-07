/**
 * Fotos del catálogo listas para el celular: la foto original puede pesar hasta 3 MB (un JPG de cámara),
 * y el catálogo la muestra en una tarjeta de ~400 px. Acá se achica a un ancho razonable y se pasa a WebP,
 * que todos los navegadores actuales leen y pesa una fracción. El resultado queda en memoria de la
 * instancia por versión de foto, y además la CDN lo guarda (la URL lleva `?v=`).
 */
import sharp from "sharp";

export const ANCHOS = [480, 960] as const;
export type Ancho = (typeof ANCHOS)[number];
export const ANCHO_POR_DEFECTO: Ancho = 960;

/** El ancho pedido (`?w=`) se redondea al permitido más cercano por arriba: no se generan tamaños a pedido. */
export function anchoPedido(w: string | null): Ancho {
  const n = Number(w);
  if (!Number.isFinite(n) || n <= 0) return ANCHO_POR_DEFECTO;
  return ANCHOS.find((a) => n <= a) ?? ANCHOS[ANCHOS.length - 1];
}

const MAX_ENTRADAS = 40;
const memo = new Map<string, Buffer>();

export async function fotoOptimizada(clave: string, original: Buffer, ancho: Ancho): Promise<Buffer> {
  const k = `${clave}:${ancho}`;
  const hit = memo.get(k);
  if (hit) return hit;
  const out = await sharp(original, { failOn: "none" })
    .rotate() // respeta la orientación de la foto del celular (EXIF) y la descarta
    .resize({ width: ancho, withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();
  if (memo.size >= MAX_ENTRADAS) memo.delete(memo.keys().next().value as string);
  memo.set(k, out);
  return out;
}
