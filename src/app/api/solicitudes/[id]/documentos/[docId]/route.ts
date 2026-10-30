import { prisma } from "@/lib/db";
import { getAnySession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/http";
import { decryptDoc } from "@/lib/docs-crypto";

export const dynamic = "force-dynamic";

/**
 * Abre un documento del legajo para que un ADMIN lo revise antes de aprobar.
 * Se descifra en el servidor y se sirve en línea, sin caché: cada apertura queda en auditoría.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;

  const session = await getAnySession();
  if (!session) return new Response("No autorizado", { status: 401 });
  if (session.mustChangePassword) return new Response("Cambiá tu clave temporal antes de continuar.", { status: 403 });
  if (session.role !== "ADMIN")
    return new Response("Solo un administrador puede abrir la documentación del legajo.", { status: 403 });

  const doc = await prisma.accessDocument.findFirst({
    where: { id: docId, requestId: id },
    select: {
      id: true,
      tipo: true,
      mime: true,
      size: true,
      data: true,
      iv: true,
      tag: true,
      request: { select: { firstName: true, lastName: true } },
    },
  });
  if (!doc) return new Response("No encontrado", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = decryptDoc(doc);
  } catch {
    return new Response("No pudimos descifrar el archivo.", { status: 500 });
  }

  await audit({
    actorId: session.id,
    action: "ACCESS_DOC_VIEW",
    entity: "AccessDocument",
    entityId: doc.id,
    ip: clientIp(req),
    payload: { requestId: id, tipo: doc.tipo, persona: `${doc.request.lastName}, ${doc.request.firstName}` },
  });

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
