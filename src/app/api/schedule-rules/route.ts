import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { badRequest } from "@/lib/errors";

const Body = z.object({
  weekday: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(1).max(1440),
  slotMin: z.number().int().min(5).max(120),
  capacity: z.number().int().min(1).max(20),
});

/**
 * Crea la franja de un día que todavía no tenía. El calendario muestra los siete días, así que el
 * club puede abrir el domingo sin pasar por nosotros.
 */
export const POST = route(async (req) => {
  const actor = await requireUser(["ADMIN"]);
  const input = await body(req, Body);
  if (input.endMin <= input.startMin) throw badRequest("FRANJA_INVALIDA", "El cierre tiene que ser posterior a la apertura.");

  const yaHay = await prisma.scheduleRule.findFirst({ where: { weekday: input.weekday } });
  if (yaHay) throw badRequest("FRANJA_EXISTENTE", "Ese día ya tiene una franja cargada.");

  const rule = await prisma.scheduleRule.create({ data: { ...input, active: true } });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id, action: "SCHEDULE_RULE_ADD", entity: "ScheduleRule", entityId: rule.id,
      payload: { weekday: rule.weekday, startMin: rule.startMin, endMin: rule.endMin, capacity: rule.capacity },
    },
  });
  return { rule };
});
