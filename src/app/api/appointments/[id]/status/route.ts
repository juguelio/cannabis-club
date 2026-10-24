import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { changeStatus, dayBoard, isStatus } from "@/lib/appointments-db";
import { dayKeyOf } from "@/lib/appointments";

const Body = z.object({
  status: z.string().min(1),
  reason: z.string().max(300).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(["ADMIN", "OPERADOR"]);
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());
    if (!isStatus(body.status)) return json({ error: "VALIDATION", message: "Estado inválido" }, 400);

    const appointment = await changeStatus({ id, status: body.status, reason: body.reason, userId: user.id });
    return json({ appointment, board: await dayBoard(dayKeyOf(appointment.scheduledAt)) });
  } catch (error) {
    return fail(error);
  }
}
