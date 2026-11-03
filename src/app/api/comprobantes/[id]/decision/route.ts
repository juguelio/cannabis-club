import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { clientIp } from "@/lib/http";
import { decidirComprobante, comprobantesEnRevision } from "@/lib/comprobantes";

const Body = z.object({
  decision: z.enum(["APROBAR", "RECHAZAR"]),
  motivo: z.string().trim().max(300).optional().nullable(),
});

/** El club aprueba o rechaza el comprobante del aporte. Aprobar confirma el pedido. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(["ADMIN", "OPERADOR"]);
  const input = await body(req, Body);

  const resultado = await decidirComprobante({
    id,
    actorId: user.id,
    decision: input.decision,
    motivo: input.motivo ?? null,
    ip: clientIp(req),
  });

  return { ...resultado, comprobantes: await comprobantesEnRevision() };
});
