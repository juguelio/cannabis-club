import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";

const Body = z.object({
  capacity: z.number().int().min(1).max(20).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(["ADMIN"]);
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());
    const exists = await prisma.scheduleRule.findUnique({ where: { id } });
    if (!exists) throw notFound("Franja inexistente");
    const rule = await prisma.scheduleRule.update({ where: { id }, data: body });
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: "SCHEDULE_RULE_UPDATE",
        entity: "ScheduleRule",
        entityId: id,
        payload: { from: { capacity: exists.capacity, active: exists.active }, to: body },
      },
    });
    return json({ rule });
  } catch (error) {
    return fail(error);
  }
}
