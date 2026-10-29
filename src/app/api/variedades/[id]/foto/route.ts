import { prisma } from "@/lib/db";

/**
 * Foto pública de una variedad, para el catálogo del sitio y del portal.
 * Sin datos personales: sólo la imagen del producto. Con `?v=<versión>` se cachea para siempre;
 * cada cambio de foto sube la versión y obliga a bajar la nueva.
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

  const pedida = new URL(req.url).searchParams.get("v");
  const alDia = pedida != null && Number(pedida) === Number(foto.fotoVersion);

  return new Response(new Uint8Array(foto.fotoData), {
    headers: {
      "Content-Type": foto.fotoMime,
      "Content-Length": String(foto.fotoData.length),
      "Cache-Control": alDia ? "public, max-age=31536000, immutable" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
