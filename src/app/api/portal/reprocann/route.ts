import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/http";
import { prisma } from "@/lib/db";

/**
 * El socio contesta, una sola vez, si tiene REPROCANN.
 *
 * No es un dato clínico ni habilita nada: es la primera pregunta de la puerta, la que decide si el
 * portal le muestra el formulario de validación (ya lo tiene, suba DNI y credencial) o la guía de
 * cómo sacarlo. Se guarda con fecha y queda en la auditoría porque define qué pantalla ve, y una
 * respuesta equivocada encierra al socio en el camino que no era.
 *
 * El socio puede corregirla desde el mismo portal: no es un estado de una sola dirección.
 */
const Body = z.object({ declaracion: z.enum(["TIENE", "NO_TIENE"]) });

export const POST = route(async (req) => {
  const socio = await requireMember();
  const { declaracion } = await body(req, Body);

  const antes = await prisma.member.findUniqueOrThrow({
    where: { id: socio.memberId },
    select: { reprocannDeclaracion: true },
  });

  await prisma.member.update({
    where: { id: socio.memberId },
    data: { reprocannDeclaracion: declaracion, reprocannAskedAt: new Date() },
  });

  await audit({
    actorId: socio.id,
    action: "REPROCANN_DECLARACION",
    entity: "Member",
    entityId: socio.memberId,
    ip: clientIp(req),
    payload: { antes: antes.reprocannDeclaracion, ahora: declaracion, origen: "portal_del_socio" },
  });

  return {
    declaracion,
    mensaje:
      declaracion === "TIENE"
        ? "Bien: te pedimos DNI y credencial para dejar el legajo en orden."
        : "Sin problema: acá te explicamos cómo sacarlo. Cuando lo tengas, volvés y lo subís.",
  };
});
