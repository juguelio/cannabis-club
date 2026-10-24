import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { route, searchParams } from "@/lib/api";

/** Actividad del club (AuditLog), paginada por cursor. Sólo ADMIN. */
export const GET = route(async (req) => {
  await requireUser(["ADMIN"]);
  const sp = searchParams(req);
  const entity = sp.get("entity") || undefined;
  const entityId = sp.get("entityId") || undefined;
  const cursor = sp.get("cursor") || undefined;
  const take = Math.min(100, Number(sp.get("take") ?? 40) || 40);
  const rows = await prisma.auditLog.findMany({
    where: { ...(entity ? { entity } : {}), ...(entityId ? { entityId } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { actor: { select: { name: true, role: true } } },
  });
  const more = rows.length > take;
  const items = rows.slice(0, take);
  return { items, nextCursor: more ? items[items.length - 1].id : null };
});
