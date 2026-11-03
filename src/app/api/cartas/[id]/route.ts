import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/http";
import { conflict, notFound, unprocessable } from "@/lib/errors";
import { puedeEditarse, faltantesDeCarta, type ContenidoCarta } from "@/lib/cartas-rules";
import { contenidoCarta } from "@/lib/cartas-schema";

/** Detalle de una edición. Devuelve el contenido y quién la aprobó, no el HTML: eso lo arma la plantilla. */
export const GET = route<{ id: string }>(async (_req, { id }) => {
  await requireUser(["ADMIN", "OPERADOR"]);
  const carta = await prisma.edicionCarta.findUnique({
    where: { id },
    select: {
      id: true, edicion: true, titulo: true, copete: true, apertura: true, bloques: true, cta: true,
      estado: true, programadaPara: true, enviadaEn: true, alcanzados: true, enviados: true, errores: true,
      creadaPor: { select: { name: true } }, aprobadaPor: { select: { name: true } }, aprobadaEn: true, createdAt: true,
    },
  });
  if (!carta) throw notFound("Esa carta no existe.");
  return { carta };
});

/**
 * Editar el contenido. Sólo mientras es borrador: una vez aprobada, lo que se manda es lo que se
 * aprobó, y cambiarle el texto después de la firma sería mandar otra cosa con la misma firma.
 */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const staff = await requireUser(["ADMIN"]);
  const actual = await prisma.edicionCarta.findUnique({ where: { id }, select: { estado: true } });
  if (!actual) throw notFound("Esa carta no existe.");
  if (!puedeEditarse(actual.estado)) throw conflict("CARTA_APROBADA", "La carta ya está aprobada: no se puede editar. Duplicala para cambiarla.");

  const input = await body(req, contenidoCarta);
  const faltan = faltantesDeCarta(input as ContenidoCarta);
  if (faltan.length) throw unprocessable("CARTA_INCOMPLETA", "Faltan datos para guardar la carta.", faltan);

  const carta = await prisma.edicionCarta.update({
    where: { id },
    data: {
      edicion: input.edicion,
      titulo: input.titulo,
      copete: input.copete,
      apertura: input.apertura,
      bloques: input.bloques,
      // `DbNull` explícito: borrar el botón es un dato, no "no lo toques".
      cta: input.cta ?? Prisma.DbNull,
    },
    select: { id: true, edicion: true, estado: true },
  });
  await audit({ actorId: staff.id, action: "CARTA_EDITADA", entity: "EdicionCarta", entityId: id, ip: clientIp(req), payload: { edicion: carta.edicion } });
  return carta;
});
