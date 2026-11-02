import { z } from "zod";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { clientIp } from "@/lib/http";
import { aprobarVerificacion, rechazarVerificacion } from "@/lib/verificacion";

const Body = z.object({
  decision: z.enum(["APROBAR", "RECHAZAR"]),
  motivo: z.string().max(400).optional(),
});

export const dynamic = "force-dynamic";

/** Aprobar aplica el documento a la ficha; rechazar deja motivo para que el socio corrija. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(["ADMIN"]);
  const body = Body.parse(await req.json());

  if (body.decision === "APROBAR") {
    const r = await aprobarVerificacion({ id, actorId: user.id, ip: clientIp(req) });
    return {
      ok: true,
      legajo: r.legajo,
      mensaje: r.vigente
        ? `Legajo ${r.legajo} validado: DNI y REPROCANN quedaron verificados.`
        : `Legajo ${r.legajo} validado, pero el REPROCANN que presentó está vencido: no va a poder retirar hasta renovarlo.`,
    };
  }

  const r = await rechazarVerificacion({ id, actorId: user.id, motivo: body.motivo ?? "", ip: clientIp(req) });
  return { ok: true, legajo: r.legajo, mensaje: `Le pedimos al legajo ${r.legajo} que corrija la presentación.` };
});
