import { requireUser } from "@/lib/auth";
import { clientIp } from "@/lib/http";
import { comprobanteParaVer } from "@/lib/comprobantes";
import { cabecerasDeArchivo, nombreDeArchivo } from "@/lib/file-headers";

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
    headers: cabecerasDeArchivo({
      mime,
      bytes: bytes.length,
      nombre: nombreDeArchivo("comprobante", mime),
    }),
  });
}
