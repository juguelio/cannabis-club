import { prisma } from "@/lib/db";
import { anchoPedido, fotoOptimizada } from "@/lib/foto-catalogo";

/**
 * Foto pública de una variedad, para el catálogo del sitio y del portal.
 * Sin datos personales: sólo la imagen del producto. Con `?v=<versión>` se cachea para siempre
 * (navegador y CDN); cada cambio de foto sube la versión y obliga a bajar la nueva.
 *
 * Se sirve achicada y en WebP (`?w=480` para tarjetas chicas, 960 por defecto). `?original=1` devuelve
 * el archivo tal como se subió, para el panel del club.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await prisma.$queryRaw<{ fotoMime: string | null; fotoVersion: number; fotoData: Buffer | null }[]>`
    SELECT "fotoMime", "fotoVersion", "fotoData" FROM "Strain" WHERE id = ${id} LIMIT 1
  `;
  const foto = rows[0];
  if (!foto?.fotoData || !foto.fotoMime) {
    return new Response("Sin foto", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  }

  const url = new URL(req.url);
  const pedida = url.searchParams.get("v");
  const alDia = pedida != null && Number(pedida) === Number(foto.fotoVersion);
  const cache = alDia ? "public, max-age=31536000, s-maxage=31536000, immutable" : "public, max-age=300";
  const comunes = { "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" };

  const original = Buffer.from(foto.fotoData);
  if (url.searchParams.get("original") !== "1") {
    try {
      const ancho = anchoPedido(url.searchParams.get("w"));
      const webp = await fotoOptimizada(`${id}:${foto.fotoVersion}`, original, ancho);
      // Si la original ya era más liviana (foto chica bien comprimida), va la original.
      if (webp.length < original.length) {
        return new Response(new Uint8Array(webp), {
          headers: { "Content-Type": "image/webp", "Content-Length": String(webp.length), "Cache-Control": cache, ...comunes },
        });
      }
    } catch (error) {
      // Una foto que sharp no puede leer igual se muestra: va la original.
      console.warn(JSON.stringify({ evento: "foto_sin_optimizar", id, error: String(error).slice(0, 120) }));
    }
  }

  return new Response(new Uint8Array(original), {
    headers: { "Content-Type": foto.fotoMime, "Content-Length": String(original.length), "Cache-Control": cache, ...comunes },
  });
}
