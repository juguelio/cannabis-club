import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { z } from "zod";
import { body, route } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { validarPrecios } from "@/lib/precios";

/**
 * Precios y aportes del club: membresías, envíos y productos.
 * Guardar acá también deja el `aportePorGramo` que usa la cuenta corriente en cada entrega.
 */
export const PATCH = route(async (req) => {
  const actor = await requireUser(["ADMIN"]);
  // La forma fina la valida `validarPrecios`, que es pura y testeable; acá sólo se pide un objeto.
  const input = await body(req, z.record(z.string(), z.unknown()));
  const r = validarPrecios(input);
  if (!r.ok) throw badRequest("PRECIOS_INVALIDOS", r.error);

  const club = await prisma.club.update({
    where: { id: "singleton" },
    data: { precios: r.precios, aportePorGramo: r.aportePorGramo },
    select: { precios: true, aportePorGramo: true },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "CLUB_UPDATE",
      entity: "Club",
      entityId: "singleton",
      ip: clientIp(req),
      payload: { precios: true, aportePorGramo: r.aportePorGramo == null ? null : Number(r.aportePorGramo) },
    },
  });
  return { ok: true, precios: club.precios, aportePorGramo: club.aportePorGramo == null ? null : Number(club.aportePorGramo) };
});
