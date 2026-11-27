import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { cabecerasDeArchivo } from "@/lib/file-headers";
import { guardarFotoLote } from "@/lib/batch-photo";

type Params = { id: string; fotoId: string };
export const POST = route<Params>((req, { id, fotoId }) => guardarFotoLote(req, id, fotoId));
export const GET = route<Params>(async (_req, { id, fotoId }) => {
  await requireUser();
  const foto = await prisma.batchPhoto.findFirst({ where: { id: fotoId, batchId: id }, select: { data: true } });
  if (!foto) throw notFound("Foto inexistente.");
  return new Response(new Uint8Array(foto.data), { headers: cabecerasDeArchivo({
    mime: "image/webp", bytes: foto.data.length, nombre: "foto-del-lote.webp",
  }) });
});
