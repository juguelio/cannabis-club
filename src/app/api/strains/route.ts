import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";

const Body = z.object({
  name: z.string().trim().min(2).max(80),
  genetics: z.string().optional(),
  thcPct: z.number().min(0).max(100).optional(),
  cbdPct: z.number().min(0).max(100).optional(),
});

export async function GET() {
  try {
    await requireUser();
    const strains = await prisma.strain.findMany({ where: { active: true }, orderBy: { name: "asc" } });
    return json({ strains });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(["ADMIN", "OPERADOR"]);
    const body = Body.parse(await req.json());
    const strain = await prisma.$transaction(async (tx) => {
      const strain = await tx.strain.create({ data: { ...body, name: body.name.trim() } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "STRAIN_CREATE", entity: "Strain", entityId: strain.id, payload: { name: strain.name } } });
      return strain;
    });
    return json({ strain }, 201);
  } catch (error) {
    return fail(error);
  }
}
