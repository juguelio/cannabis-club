import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { route, searchParams } from "@/lib/api";
import { memberIdsByName } from "@/lib/member-search";

/** Búsqueda global del mostrador: legajo, apellido, nombre, DNI, REPROCANN o código de lote. */
export const GET = route(async (req) => {
  await requireUser();
  const q = (searchParams(req).get("q") ?? "").trim();
  if (q.length < 1) return { members: [], batches: [] };
  const digits = q.replace(/[.\s-]/g, "");
  const legajo = /^\d{1,6}$/.test(digits) ? Number(digits) : null;
  const nameIds = await memberIdsByName(q, 50);

  const [members, batches] = await Promise.all([
    prisma.member.findMany({
      where: {
        OR: [
          ...(legajo != null ? [{ legajo }] : []),
          { docNumber: { contains: digits } },
          { reprocannNumber: { contains: q, mode: "insensitive" as const } },
          { id: { in: nameIds } },
        ],
      },
      orderBy: [{ status: "asc" }, { lastName: "asc" }],
      take: 8,
      select: { id: true, legajo: true, firstName: true, lastName: true, docNumber: true, status: true, reprocannStatus: true, reprocannExpiresAt: true },
    }),
    prisma.batch.findMany({
      where: { OR: [{ code: { contains: q, mode: "insensitive" } }, { strain: { name: { contains: q, mode: "insensitive" } } }] },
      take: 5,
      orderBy: { code: "desc" },
      select: { id: true, code: true, stage: true, strain: { select: { name: true } } },
    }),
  ]);
  // El legajo exacto primero: es lo que tipea el mostrador.
  members.sort((a, b) => Number(b.legajo === legajo) - Number(a.legajo === legajo));
  return { members, batches };
});
