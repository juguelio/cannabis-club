import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(["ADMIN"]);
    const { id } = await ctx.params;
    const day = await prisma.closedDay.findUnique({ where: { id } });
    if (!day) throw notFound("Día cerrado inexistente");
    await prisma.closedDay.delete({ where: { id } });
    await prisma.auditLog.create({
      data: { actorId: session.id, action: "CLOSED_DAY_REMOVE", entity: "ClosedDay", entityId: id, payload: { date: day.date.toISOString().slice(0, 10) } },
    });
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
