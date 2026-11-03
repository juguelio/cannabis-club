import { requireUser } from "@/lib/auth";
import { clientIp } from "@/lib/http";
import { comprobanteParaVer } from "@/lib/comprobantes";

export const dynamic = "force-dynamic";

/**
 * Abre un comprobante de pago para que el club lo mire. Se descifra en el servidor, se sirve en línea
 * y sin caché; cada apertura queda auditada (es el comprobante de una transferencia).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["ADMIN", "OPERADOR"]);

  const { bytes, mime } = await comprobanteParaVer({ id, actorId: user.id, ip: clientIp(req) });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="comprobante${mime === "application/pdf" ? ".pdf" : ""}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
