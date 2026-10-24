import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { parsePadron } from "@/lib/padron-import";

const Body = z.object({ csv: z.string().min(1).max(2_000_000), commit: z.boolean().default(false) });

/**
 * Importa el padrón. Sin `commit` es una vista previa: no escribe nada.
 * Con `commit`, todas las filas válidas entran en una sola transacción (o ninguna),
 * como PENDIENTE: activar a cada socio sigue siendo un acto del club.
 */
export const POST = route(async (req) => {
  const actor = await requireUser(["ADMIN"]);
  const { csv, commit } = await body(req, Body);
  const parsed = parsePadron(csv);
  const existing = await prisma.member.findMany({
    where: { docNumber: { in: parsed.rows.map((r) => r.docNumber) } },
    select: { docNumber: true, legajo: true },
  });
  const known = new Map(existing.map((m) => [m.docNumber, m.legajo]));
  const fresh = parsed.rows.filter((r) => !known.has(r.docNumber));
  const skipped = parsed.rows.filter((r) => known.has(r.docNumber)).map((r) => ({ line: r.line, docNumber: r.docNumber, legajo: known.get(r.docNumber)! }));

  if (!commit) return { preview: fresh, skipped, issues: parsed.issues, headers: parsed.headers };
  if (fresh.length === 0) return { created: 0, skipped, issues: parsed.issues };

  const created = await prisma.$transaction(async (tx) => {
    const last = await tx.member.aggregate({ _max: { legajo: true } });
    let legajo = last._max.legajo ?? 0;
    const day = (v: string | null) => (v ? new Date(`${v}T00:00:00.000Z`) : null);
    for (const r of fresh) {
      legajo += 1;
      await tx.member.create({
        data: {
          legajo,
          firstName: r.firstName,
          lastName: r.lastName,
          docNumber: r.docNumber,
          birthDate: day(r.birthDate)!,
          phone: r.phone,
          email: r.email,
          address: r.address,
          reprocannNumber: r.reprocannNumber,
          reprocannStatus: r.reprocannStatus,
          reprocannExpiresAt: day(r.reprocannExpiresAt),
          consumptionType: r.consumptionType,
          monthlyForecastG: r.monthlyForecastG,
          consentSignedAt: day(r.consentSignedAt),
          status: "PENDIENTE",
          notes: `Importado del padrón (fila ${r.line})`,
        },
      });
    }
    await tx.auditLog.create({
      data: { actorId: actor.id, action: "MEMBER_IMPORT", entity: "Member", ip: clientIp(req), payload: { created: fresh.length, skipped: skipped.length, issues: parsed.issues.length } },
    });
    return fresh.length;
  }, { isolationLevel: "Serializable", timeout: 60_000 });

  return { created, skipped, issues: parsed.issues };
});
