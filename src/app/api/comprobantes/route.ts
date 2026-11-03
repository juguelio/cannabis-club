import { requireUser } from "@/lib/auth";
import { comprobantesEnRevision } from "@/lib/comprobantes";

export const dynamic = "force-dynamic";

/** Cola de comprobantes esperando decisión del club. */
export async function GET() {
  await requireUser(["ADMIN", "OPERADOR"]);
  return Response.json({ comprobantes: await comprobantesEnRevision() });
}
