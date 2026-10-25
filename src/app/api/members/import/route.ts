import { z } from "zod";
import { prisma } from "@/lib/db";
import { docFingerprint } from "@/lib/privacy";
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
    where: { docHash: { in: parsed.rows.map((r) => docFingerprint(r.docNumber).docHash) } },
    select: { docHash: true, legajo: true },
  });
  const known = new Map(existing.map((m) => [m.docHash!, m.legajo]));
  const hashOf = (doc: string) => docFingerprint(doc).docHash;
  const fresh = parsed.rows.filter((r) => !known.has(hashOf(r.docNumber)));
  const skipped = parsed.rows
    .filter((r) => known.has(hashOf(r.docNumber)))
    .map((r) => ({ line: r.line, docNumber: `····${r.docNumber.slice(-4)}`, legajo: known.get(hashOf(r.docNumber))! }));

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
          docHash: docFingerprint(r.docNumber).docHash,
          docLast4: docFingerprint(r.docNumber).docLast4,
          docVerifiedAt: new Date(),
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
