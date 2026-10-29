import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail, json, clientIp } from "@/lib/http";

const Body = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  genetics: z.string().trim().max(80).nullable().optional(),
  thcPct: z.number().min(0).max(100).nullable().optional(),
  cbdPct: z.number().min(0).max(100).nullable().optional(),
  active: z.boolean().optional(),
});

/** Edición de la ficha de la variedad. No se borra: se apaga (`active: false`) para no romper el historial de lotes. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(["ADMIN", "OPERADOR"]);
    const { id } = await params;
    const body = Body.parse(await req.json());

    const previa = await prisma.strain.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!previa) return json({ error: "NO_ENCONTRADO", message: "Esa variedad no existe." }, 404);

    const strain = await prisma.$transaction(async (tx) => {
      const s = await tx.strain.update({
        where: { id },
        data: {
          ...(body.name != null ? { name: body.name } : {}),
          ...(body.genetics !== undefined ? { genetics: body.genetics } : {}),
          ...(body.thcPct !== undefined ? { thcPct: body.thcPct } : {}),
          ...(body.cbdPct !== undefined ? { cbdPct: body.cbdPct } : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
        },
        select: { id: true, name: true, genetics: true, thcPct: true, cbdPct: true, active: true, fotoVersion: true },
      });
      await tx.auditLog.create({
        data: { actorId: user.id, action: "STRAIN_EDIT", entity: "Strain", entityId: id, ip: clientIp(req), payload: { antes: previa.name, ...body } },
      });
      return s;
    });

    return json({ strain });
  } catch (error) {
    return fail(error);
  }
}
