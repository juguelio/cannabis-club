import type { LimitConfig } from "./limits";
import { prisma } from "./db";

export const CLUB_ID = "singleton";

const num = (v: unknown, fallback: number) => (v == null ? fallback : Number(v));

export async function getClub() {
  return prisma.club.upsert({
    where: { id: CLUB_ID },
    update: {},
    create: { id: CLUB_ID, nombre: "Club de cultivo (sin configurar)" },
  });
}

export function limitsFromClub(club: Awaited<ReturnType<typeof getClub>>): LimitConfig {
  return {
    limiteDiarioG: num(club.limiteDiarioG, 25),
    limiteMensualG: num(club.limiteMensualG, 50),
    limiteMenorG: num(club.limiteMenorG, 30),
    edadMinima: club.edadMinima,
    edadLimiteMenor: club.edadLimiteMenor,
    thcMaxMenor: club.thcMaxMenor == null ? null : Number(club.thcMaxMenor),
    requiereReprocann: club.requiereReprocann,
  };
}
