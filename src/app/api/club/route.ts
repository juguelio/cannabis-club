import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getClub, CLUB_ID } from "@/lib/club";
import { audit } from "@/lib/audit";
import { clientIp, fail, json } from "@/lib/http";

const Body = z.object({
  nombre: z.string().min(2).optional(),
  cuit: z.string().optional(),
  reprocannNumber: z.string().optional(),
  reprocannCode: z.string().optional(),
  directorMedico: z.string().optional(),
  responsableTecnico: z.string().optional(),
  limiteDiarioG: z.number().positive().optional(),
  limiteMensualG: z.number().positive().optional(),
  limiteMenorG: z.number().positive().optional(),
  edadMinima: z.number().int().min(18).optional(),
  edadLimiteMenor: z.number().int().min(18).optional(),
  thcMaxMenor: z.number().min(0).max(100).nullable().optional(),
  maxSocios: z.number().int().positive().optional(),
  requiereReprocann: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireUser();
    const club = await getClub();
    return json({ club });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser(["ADMIN"]);
    const body = Body.parse(await req.json());
    await getClub();
    const club = await prisma.club.update({ where: { id: CLUB_ID }, data: body });
    await audit({ actorId: user.id, action: "CLUB_UPDATE", entity: "Club", entityId: CLUB_ID, ip: clientIp(req), payload: body });
    return json({ club });
  } catch (error) {
    return fail(error);
  }
}
