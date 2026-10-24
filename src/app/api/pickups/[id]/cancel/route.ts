import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { cancelPickup, listPickups } from "@/lib/pickups";

const Body = z.object({ reason: z.string().trim().min(3, "Indicá el motivo").max(300) });

export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(["ADMIN", "OPERADOR"]);
  const { reason } = await body(req, Body);
  await cancelPickup({ id, actorId: user.id, reason });
  return { pickups: await listPickups() };
});
