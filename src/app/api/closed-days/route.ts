import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { conflict } from "@/lib/errors";

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireUser(["ADMIN"]);
    const body = Body.parse(await req.json());
    const date = new Date(`${body.date}T00:00:00.000Z`);
    const exists = await prisma.closedDay.findUnique({ where: { date } });
    if (exists) throw conflict("DAY_ALREADY_CLOSED", "Ese día ya está cerrado.");
    const day = await prisma.closedDay.create({ data: { date, reason: body.reason ?? null } });
    await prisma.auditLog.create({
      data: { actorId: session.id, action: "CLOSED_DAY_ADD", entity: "ClosedDay", entityId: day.id, payload: { date: body.date, reason: body.reason ?? null } },
    });
    return json({ day: { id: day.id, date: body.date } }, 201);
  } catch (error) {
    return fail(error);
  }
}
