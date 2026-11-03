import { route, searchParams } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { clientIp } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { DOC_MIMES, MAX_DOC_BYTES } from "@/lib/docs-crypto";
import { subirComprobante } from "@/lib/comprobantes";

export const dynamic = "force-dynamic";

/**
 * El socio sube la foto del comprobante de la transferencia de un pedido suyo.
 * Cuerpo = archivo crudo (no multipart), igual que los documentos del legajo.
 */
export const POST = route(async (req) => {
  const session = await requireMember();
  const params = searchParams(req);

  const pickupId = params.get("pickupId");
  if (!pickupId) throw badRequest("PEDIDO_REQUERIDO", "Falta el pedido al que corresponde el comprobante.");

  const mime = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!(DOC_MIMES as readonly string[]).includes(mime))
    throw badRequest("MIME_INVALIDO", "Sólo se aceptan fotos (JPG, PNG, WEBP) o PDF.");

  const largo = Number(req.headers.get("content-length") ?? 0);
  if (largo > MAX_DOC_BYTES) throw badRequest("ARCHIVO_GRANDE", "El archivo supera los 6 MB.");

  const montoRaw = params.get("monto");
  const monto = montoRaw ? Number(montoRaw.replace(",", ".")) : null;
  if (montoRaw && (!Number.isFinite(monto) || (monto ?? 0) <= 0))
    throw badRequest("MONTO_INVALIDO", "Poné el monto que transferiste, en pesos.");

  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length > MAX_DOC_BYTES) throw badRequest("ARCHIVO_GRANDE", "El archivo supera los 6 MB.");

  return subirComprobante({
    pickupId,
    memberId: session.memberId,
    actorId: session.id,
    monto,
    referencia: params.get("referencia"),
    mime,
    bytes,
    ip: clientIp(req),
  });
});
