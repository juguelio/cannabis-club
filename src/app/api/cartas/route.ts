import { prisma } from "@/lib/db";
import { body, created, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/http";
import { alcanzablesPara } from "@/lib/cartas";
import { faltantesDeCarta, type ContenidoCarta } from "@/lib/cartas-rules";
import { crearCarta } from "@/lib/cartas-schema";
import { unprocessable } from "@/lib/errors";

/**
 * Las cartas del club.
 *
 * Leer: cualquier staff que pueda ver el padrón. Escribir: ADMIN. La carta es la voz de la
 * asociación; la firma la comisión, no cualquiera que entre a la consola.
 */
export const GET = route(async () => {
  await requireUser(["ADMIN", "OPERADOR"]);
  const cartas = await prisma.edicionCarta.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    select: {
      id: true, edicion: true, titulo: true, copete: true, estado: true, programadaPara: true,
      enviadaEn: true, alcanzados: true, enviados: true, errores: true, createdAt: true,
      creadaPor: { select: { name: true } }, aprobadaPor: { select: { name: true } }, aprobadaEn: true,
    },
  });
  return { cartas, padron: await alcanzablesPara() };
});

export const POST = route(async (req) => {
  const staff = await requireUser(["ADMIN"]);
  const input = await body(req, crearCarta);
  const faltan = faltantesDeCarta(input as ContenidoCarta);
  if (faltan.length) throw unprocessable("CARTA_INCOMPLETA", "Faltan datos para guardar la carta.", faltan);

  const carta = await prisma.edicionCarta.create({
    data: {
      edicion: input.edicion,
      titulo: input.titulo,
      copete: input.copete,
      apertura: input.apertura,
      bloques: input.bloques,
      cta: input.cta ?? undefined,
      creadaPorId: staff.id,
    },
    select: { id: true, edicion: true, estado: true },
  });
  await audit({ actorId: staff.id, action: "CARTA_CREADA", entity: "EdicionCarta", entityId: carta.id, ip: clientIp(req), payload: { edicion: carta.edicion } });
  return created(carta);
});
