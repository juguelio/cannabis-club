import { Prisma } from "@prisma/client";
import { prisma } from "./db";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const FROM = "áàäâéèëêíìïîóòöôúùüûñç";
const TO = "aaaaeeeeiiiioooouuuunc";

/**
 * Socios cuyo nombre o apellido contiene TODAS las palabras, sin importar tildes ni mayúsculas
 * ("gomez" encuentra a Gómez). Devuelve ids; el filtro fino lo hace Prisma.
 */
export async function memberIdsByName(query: string, limit = 500): Promise<string[]> {
  const words = fold(query).split(/\s+/).filter((w) => w.length > 0).slice(0, 4);
  if (words.length === 0) return [];
  const conds = words.map(
    (w) => Prisma.sql`translate(lower("firstName" || ' ' || "lastName"), ${FROM}, ${TO}) LIKE ${`%${w.replace(/[%_\\]/g, "")}%`}`,
  );
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Member" WHERE ${Prisma.join(conds, " AND ")} LIMIT ${limit}`;
  return rows.map((r) => r.id);
}
