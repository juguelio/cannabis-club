import { route, searchParams } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { clientIp } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { DOC_MIMES, DOC_TIPOS, MAX_DOC_BYTES, type DocTipo } from "@/lib/docs-crypto";
import { subirDocumentoVerificacion } from "@/lib/verificacion";

const esTipo = (v: string | null): v is DocTipo => !!v && (DOC_TIPOS as string[]).includes(v);

export const dynamic = "force-dynamic";

/**
 * Subida de un archivo de la re-validación. El cuerpo es el archivo crudo (no multipart), igual
 * que en el alta: no hay dependencias nuevas y el tamaño se controla antes de tocar la base.
 */
export const POST = route(async (req) => {
  const session = await requireMember();

  const tipo = searchParams(req).get("tipo");
  if (!esTipo(tipo)) throw badRequest("TIPO_INVALIDO", "Tipo de documento desconocido.", { tipos: DOC_TIPOS });

  const mime = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!(DOC_MIMES as readonly string[]).includes(mime))
    throw badRequest("MIME_INVALIDO", "Sólo se aceptan fotos (JPG, PNG, WEBP) o PDF.");

  const largo = Number(req.headers.get("content-length") ?? 0);
  if (largo > MAX_DOC_BYTES) throw badRequest("ARCHIVO_GRANDE", "El archivo supera los 6 MB.");

  const bytes = Buffer.from(await req.arrayBuffer());
  if (!bytes.length) throw badRequest("ARCHIVO_VACIO", "El archivo llegó vacío.");
  if (bytes.length > MAX_DOC_BYTES) throw badRequest("ARCHIVO_GRANDE", "El archivo supera los 6 MB.");

  const doc = await subirDocumentoVerificacion({
    memberId: session.memberId,
    actorId: session.id,
    tipo,
    mime,
    bytes,
    ip: clientIp(req),
  });

  return { id: doc.id, tipo: doc.tipo, size: doc.size };
});
