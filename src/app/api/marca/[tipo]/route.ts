import { IMAGE_KINDS, type ImageKind } from "@/lib/brand";
import { decodeDataUrl } from "@/lib/brand-image";
import { readBrandImage } from "@/lib/brand-db";

/**
 * Imágenes públicas de la marca (logo, emblema, portada): las usan el sitio, el ingreso y el favicon.
 * Con `?v=<versión vigente>` se cachean para siempre; cualquier cambio de marca sube la versión.
 */
export async function GET(req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (!(tipo in IMAGE_KINDS)) return new Response("No encontrado", { status: 404 });
  const { dataUrl, version } = await readBrandImage(tipo as ImageKind);
  const decoded = dataUrl ? decodeDataUrl(dataUrl) : null;
  if (!decoded) return new Response("Sin imagen", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  const asked = new URL(req.url).searchParams.get("v");
  const pinned = asked != null && Number(asked) === version;
  return new Response(new Uint8Array(decoded.bytes), {
    headers: {
      "Content-Type": decoded.mime,
      "Content-Length": String(decoded.bytes.length),
      "Cache-Control": pinned ? "public, max-age=31536000, immutable" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
