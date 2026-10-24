import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";

const Body = z.object({
  name: z.string().min(2),
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
    await requireUser(["ADMIN", "OPERADOR"]);
    const body = Body.parse(await req.json());
    const strain = await prisma.strain.create({ data: body });
    return json({ strain }, 201);
  } catch (error) {
    return fail(error);
  }
}
