import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { clientIp } from "@/lib/http";
import { decryptDoc } from "@/lib/docs-crypto";
import { abrirDocumentoVerificacion } from "@/lib/verificacion";
import { cabecerasDeArchivo, nombreDeArchivo } from "@/lib/file-headers";

export const dynamic = "force-dynamic";

/**
 * Abre un documento de la re-validación para que un ADMIN lo mire.
 * Se descifra en el servidor, se sirve en línea y sin caché: cada apertura queda en auditoría.
 * Va envuelto en `route()` para que el rol equivocado reciba 403 y no un 500.
 */
export const GET = route<{ id: string; docId: string }>(async (req, { id, docId }) => {
  const user = await requireUser(["ADMIN"]);

  const doc = await abrirDocumentoVerificacion({ verificationId: id, docId, actorId: user.id, ip: clientIp(req) });

  let bytes: Buffer;
  try {
    bytes = decryptDoc(doc);
  } catch {
    return new Response("No pudimos descifrar el archivo.", { status: 500 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: cabecerasDeArchivo({
      mime: doc.mime,
      bytes: bytes.length,
      nombre: nombreDeArchivo(doc.tipo.toLowerCase(), doc.mime),
    }),
  });
});
