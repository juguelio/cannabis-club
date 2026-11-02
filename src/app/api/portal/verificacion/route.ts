import { z } from "zod";
import { route } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { clientIp } from "@/lib/http";
import { presentarVerificacion, verificacionDelSocio } from "@/lib/verificacion";
import { estadoVerificacion, puedeOperar } from "@/lib/verificacion-rules";

const Body = z.object({
  dni: z.string().min(6).max(12),
  nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha va como AAAA-MM-DD"),
  reprocann: z.string().min(4).max(40),
  vence: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha va como AAAA-MM-DD"),
});

export const dynamic = "force-dynamic";

/** Estado del trámite del socio: qué presentó, qué falta y si ya puede operar. */
export const GET = route(async () => {
  const session = await requireMember();
  const data = await verificacionDelSocio(session.memberId);
  const estado = estadoVerificacion(data.member.verificationStatus);
  return {
    estado: data.member.verificationStatus,
    ...estado,
    puedeOperar: puedeOperar(data.member.verificationStatus),
    presentacion: data.ultima
      ? {
          id: data.ultima.id,
          enviada: data.ultima.submittedAt.toISOString(),
          motivoRechazo: data.ultima.rejectionReason,
          documentos: data.ultima.documents.map((d) => ({ id: d.id, tipo: d.tipo, size: d.size, subido: d.uploadedAt.toISOString() })),
        }
      : null,
    faltan: data.faltan,
    faltantesTexto: data.faltantesTexto,
    legajo: { numero: data.member.legajo, docLast4: data.member.docLast4, venceReprocann: data.member.reprocannExpiresAt },
  };
});

/** Paso 1: el socio declara DNI, nacimiento y REPROCANN. Los archivos van por el otro endpoint. */
export const POST = route(async (req) => {
  const session = await requireMember();
  const body = Body.parse(await req.json());
  const { id } = await presentarVerificacion({
    memberId: session.memberId,
    actorId: session.id,
    ip: clientIp(req),
    ...body,
  });
  return { id, siguiente: "Subí el DNI (frente y dorso) y la credencial del REPROCANN." };
});
