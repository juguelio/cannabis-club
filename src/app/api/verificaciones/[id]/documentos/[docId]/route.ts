import { requireUser } from "@/lib/auth";
import { clientIp } from "@/lib/http";
import { decryptDoc } from "@/lib/docs-crypto";
import { abrirDocumentoVerificacion } from "@/lib/verificacion";

export const dynamic = "force-dynamic";

/**
 * Abre un documento de la re-validación para que un ADMIN lo mire.
 * Se descifra en el servidor, se sirve en línea y sin caché: cada apertura queda en auditoría.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const user = await requireUser(["ADMIN"]);

  const doc = await abrirDocumentoVerificacion({ verificationId: id, docId, actorId: user.id, ip: clientIp(req) });

  let bytes: Buffer;
  try {
    bytes = decryptDoc(doc);
  } catch {
    return new Response("No pudimos descifrar el archivo.", { status: 500 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${doc.tipo.toLowerCase()}${doc.mime === "application/pdf" ? ".pdf" : ""}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
