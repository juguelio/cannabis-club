import { cache } from "react";
import type { LimitConfig } from "./limits";
import { prisma } from "./db";

export const CLUB_ID = "singleton";

const num = (v: unknown, fallback: number) => (v == null ? fallback : Number(v));

/** Las imágenes de marca pesan: quedan fuera de la ficha del club y se leen solo donde se sirven. */
export const OMIT_IMAGES = { marcaLogo: true, marcaEmblema: true, marcaPortada: true } as const;

/**
 * La ficha del club. Casi siempre existe: se lee con una consulta simple y, sólo si falta (base nueva),
 * se crea. Antes era un `upsert`, que Prisma resuelve con una transacción de varios viajes a la base,
 * y se pedía varias veces por pantalla: ahora una lectura por request (cache de React).
 */
export const getClub = cache(async () => {
  const club = await prisma.club.findUnique({ where: { id: CLUB_ID }, omit: OMIT_IMAGES });
  if (club) return club;
  return prisma.club.upsert({
    where: { id: CLUB_ID },
    update: {},
    create: { id: CLUB_ID, nombre: "Club de cultivo (sin configurar)" },
    omit: OMIT_IMAGES,
  });
});

export function limitsFromClub(club: Awaited<ReturnType<typeof getClub>>): LimitConfig {
  return {
    limitePorPedidoG: num(club.limitePorPedidoG, 25),
    limiteMensualG: num(club.limiteMensualG, 50),
    limiteMenorG: num(club.limiteMenorG, 30),
    edadMinima: club.edadMinima,
    edadLimiteMenor: club.edadLimiteMenor,
    thcMaxMenor: club.thcMaxMenor == null ? null : Number(club.thcMaxMenor),
    requiereReprocann: club.requiereReprocann,
  };
}
