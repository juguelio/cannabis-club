import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { clientIp, fail, json } from "@/lib/http";
import { dayBoard, bookAppointment } from "@/lib/appointments-db";
import { dayKeyOf } from "@/lib/appointments";
import { prisma } from "@/lib/db";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const Body = z.object({
  memberId: z.string().min(1),
  date: z.string().regex(DAY),
  startMin: z.number().int().min(0).max(24 * 60 - 1),
  channel: z.enum(["MOSTRADOR", "TELEFONO", "WHATSAPP", "WEB"]).optional(),
  notes: z.string().max(500).optional(),
});

export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const day = date && DAY.test(date) ? date : dayKeyOf(new Date());
    return json(await dayBoard(day));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(["ADMIN", "OPERADOR", "DISPENSADOR"]);
    const body = Body.parse(await req.json());
    const appointment = await bookAppointment({
      memberId: body.memberId,
      dayKey: body.date,
      startMin: body.startMin,
      channel: body.channel,
      notes: body.notes,
      operatorId: user.id,
    });
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "APPOINTMENT_CREATE",
        entity: "Appointment",
        entityId: appointment.id,
        payload: { memberId: appointment.memberId, scheduledAt: appointment.scheduledAt.toISOString() },
        ip: clientIp(req),
      },
    });
    return json({ appointment, board: await dayBoard(body.date) }, 201);
  } catch (error) {
    return fail(error);
  }
}
