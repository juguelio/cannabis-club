import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { confirmPickup, listPickups } from "@/lib/pickups";

const Body = z.object({ status: z.literal("CONFIRMADA") });

/** El mostrador confirma la reserva. El retiro se registra como entrega en el dispensario. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(["ADMIN", "OPERADOR", "DISPENSADOR"]);
  await body(req, Body);
  await confirmPickup({ id, actorId: user.id });
  return { pickups: await listPickups() };
});
