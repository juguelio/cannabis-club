import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/http";
import { conflict, notFound, unprocessable } from "@/lib/errors";
import { alcanzablesPara } from "@/lib/cartas";
import { faltantesDeCarta, puedeAprobarse, type ContenidoCarta } from "@/lib/cartas-rules";
import { aprobarCarta } from "@/lib/cartas-schema";

/**
 * Aprobar la edición: el acto que convierte un borrador en algo que va a salir.
 *
 * Tres puertas, todas en el servidor:
 * - Sólo ADMIN.
 * - Sólo desde borrador (una carta enviada no se "re-aprueba").
 * - El contenido tiene que estar completo **y** tiene que haber a quién mandarla: si el padrón
 *   consentido está en cero, aprobar sería aprobar un envío a nadie.
 */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const staff = await requireUser(["ADMIN"]);
  const carta = await prisma.edicionCarta.findUnique({ where: { id } });
  if (!carta) throw notFound("Esa carta no existe.");
  if (!puedeAprobarse(carta.estado)) throw conflict("NO_ES_BORRADOR", `La carta está en ${carta.estado.toLowerCase()} y no se puede aprobar.`);

  const faltan = faltantesDeCarta({
    edicion: carta.edicion,
    titulo: carta.titulo,
    copete: carta.copete,
    apertura: (carta.apertura as string[]) ?? [],
    bloques: (carta.bloques as never) ?? [],
    cta: (carta.cta as { texto: string; url: string } | null) ?? undefined,
  } as ContenidoCarta);
  if (faltan.length) throw unprocessable("CARTA_INCOMPLETA", "La carta no está lista para aprobar.", faltan);

  const reparto = await alcanzablesPara();
  if (reparto.total === 0) {
    throw unprocessable("SIN_DESTINATARIOS", "No hay ningún socio con consentimiento de comunicaciones: la carta no se puede aprobar.");
  }

  const { programadaPara } = await body(req, aprobarCarta);
  const cuando = programadaPara ? new Date(programadaPara) : new Date();
  if (Number.isNaN(cuando.getTime())) throw unprocessable("FECHA_INVALIDA", "La fecha de programación no se entiende.");

  const actualizada = await prisma.edicionCarta.update({
    where: { id },
    data: {
      estado: "APROBADA",
      aprobadaPorId: staff.id,
      aprobadaEn: new Date(),
      programadaPara: cuando,
      alcanzados: reparto.total,
    },
    select: { id: true, estado: true, programadaPara: true, alcanzados: true },
  });
  await audit({
    actorId: staff.id,
    action: "CARTA_APROBADA",
    entity: "EdicionCarta",
    entityId: id,
    ip: clientIp(req),
    payload: { edicion: carta.edicion, programadaPara: actualizada.programadaPara, alcanzados: reparto.total },
  });
  return actualizada;
});
