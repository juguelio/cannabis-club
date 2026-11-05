import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { createPickup, portalOverview } from "@/lib/pickups";
import { dayKeyOf } from "@/lib/appointments";

const Body = z.object({
  /** RETIRO pide día y horario; ENVIO pide zona y dirección, y no ocupa turno. */
  mode: z.enum(["RETIRO", "ENVIO"]).default("RETIRO"),
  grams: z.number().positive().max(500),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startMin: z.number().int().min(0).max(24 * 60 - 1).optional(),
  zona: z.string().max(80).optional(),
  direccion: z.string().max(200).optional(),
  notes: z.string().max(300).optional(),
  /** El combo por variedad. `grams` sigue siendo el total; esto dice de qué está hecho. */
  items: z
    .array(z.object({ strainId: z.string().min(1), grams: z.number().positive().max(500) }))
    .max(20)
    .optional(),
});

export async function POST(req: Request) {
  try {
    const member = await requireMember();
    const body = Body.parse(await req.json());
    const { pickup } = await createPickup({
      memberId: member.memberId,
      grams: body.grams,
      mode: body.mode,
      dayKey: body.date,
      startMin: body.startMin,
      zona: body.zona,
      direccion: body.direccion,
      notes: body.notes,
      items: body.items,
    });
    return json(
      {
        pickup: {
          id: pickup.id,
          grams: Number(pickup.grams),
          status: pickup.status,
          mode: pickup.deliveryMode,
          zona: pickup.deliveryZona,
          costoEnvioArs: pickup.deliveryCostoArs == null ? null : Number(pickup.deliveryCostoArs),
        },
        overview: await portalOverview(member.memberId),
        today: dayKeyOf(new Date()),
      },
      201,
    );
  } catch (error) {
    return fail(error);
  }
}
