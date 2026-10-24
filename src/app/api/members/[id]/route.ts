import { calendarDate, optionalDate } from "@/lib/validation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { forbidden, notFound, unprocessable } from "@/lib/errors";
import { evaluateStatusChange, MEMBER_STATUSES } from "@/lib/member-rules";

const PatchBody = z.object({
  status: z.enum(MEMBER_STATUSES).optional(),
  statusReason: z.string().trim().max(300).optional(),
  firstName: z.string().trim().min(2).max(80).optional(),
  lastName: z.string().trim().min(2).max(80).optional(),
  birthDate: calendarDate.optional(),
  reprocannNumber: z.string().trim().max(100).optional(),
  reprocannStatus: z.enum(["NO_APORTA", "EN_TRAMITE", "VIGENTE", "VENCIDO", "RECHAZADO"]).optional(),
  reprocannExpiresAt: optionalDate.optional().nullable(),
  consumptionType: z.enum(["LUDICO", "TERAPEUTICO"]).optional(),
  monthlyForecastG: z.number().nonnegative().max(10000).optional().nullable(),
  consentSignedAt: optionalDate.optional().nullable(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email("Email inválido").or(z.literal("")).optional(),
  address: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const day = (v: string | null | undefined) => (v ? new Date(`${v}T00:00:00.000Z`) : null);

export const GET = route<{ id: string }>(async (_req, { id }) => {
  await requireUser();
  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      dispensations: {
        orderBy: { occurredAt: "desc" },
        take: 50,
        include: { batch: { include: { strain: true } }, operator: { select: { id: true, name: true } } },
      },
    },
  });
  if (!member) throw notFound("Socio inexistente");
  return { member };
});

/**
 * Edición del legajo. Todo en una transacción con su auditoría (antes → después):
 * si la auditoría no se escribe, el cambio tampoco.
 */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(["ADMIN", "OPERADOR"]);
  const input = await body(req, PatchBody);
  if ((input.firstName || input.lastName || input.birthDate) && user.role !== "ADMIN")
    throw forbidden("Corregir nombre o nacimiento lo hace un administrador.");

  const member = await prisma.$transaction(async (tx) => {
    const current = await tx.member.findUnique({ where: { id } });
    if (!current) throw notFound("Socio inexistente");

    const consentAfter = input.consentSignedAt !== undefined ? Boolean(input.consentSignedAt) : Boolean(current.consentSignedAt);
    if (input.status && input.status !== current.status) {
      const decision = evaluateStatusChange({ from: current.status, to: input.status, reason: input.statusReason, consentSigned: consentAfter });
      if (!decision.ok) throw unprocessable(decision.code, decision.message);
    }

    const data: Prisma.MemberUpdateInput = {
      ...(input.status && input.status !== current.status
        ? {
            status: input.status,
            statusReason: input.statusReason || null,
            ...(input.status === "ACTIVO" && !current.admittedAt ? { admittedAt: new Date() } : {}),
            ...(input.status === "BAJA" ? { leftAt: new Date() } : {}),
            ...(current.status === "BAJA" ? { leftAt: null } : {}),
          }
        : {}),
      ...(input.firstName ? { firstName: input.firstName } : {}),
      ...(input.lastName ? { lastName: input.lastName } : {}),
      ...(input.birthDate ? { birthDate: day(input.birthDate)! } : {}),
      ...(input.reprocannNumber !== undefined ? { reprocannNumber: input.reprocannNumber || null } : {}),
      ...(input.reprocannStatus ? { reprocannStatus: input.reprocannStatus } : {}),
      ...(input.reprocannExpiresAt !== undefined ? { reprocannExpiresAt: day(input.reprocannExpiresAt) } : {}),
      ...(input.consumptionType ? { consumptionType: input.consumptionType } : {}),
      ...(input.monthlyForecastG !== undefined ? { monthlyForecastG: input.monthlyForecastG } : {}),
      ...(input.consentSignedAt !== undefined ? { consentSignedAt: day(input.consentSignedAt) } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.address !== undefined ? { address: input.address || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    };

    const updated = await tx.member.update({ where: { id }, data });

    // Sólo lo que cambió, con su valor anterior: la auditoría tiene que poder leerse.
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const plain = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v instanceof Prisma.Decimal ? Number(v) : v ?? null);
    for (const key of Object.keys(input) as (keyof typeof input)[]) {
      if (key === "statusReason") continue;
      const before = plain(current[key as keyof typeof current]);
      const after = plain(updated[key as keyof typeof updated]);
      if (JSON.stringify(before) !== JSON.stringify(after)) changes[key] = { from: before, to: after };
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: changes.status ? "MEMBER_STATUS" : "MEMBER_UPDATE",
        entity: "Member",
        entityId: id,
        ip: clientIp(req),
        payload: { changes, reason: input.statusReason ?? null } as Prisma.InputJsonValue,
      },
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return { member };
});
