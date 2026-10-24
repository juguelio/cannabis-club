import { optionalDate } from "@/lib/validation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { clientIp, fail, json } from "@/lib/http";
import { notFound } from "@/lib/errors";

const PatchBody = z.object({
  status: z.enum(["PENDIENTE", "ACTIVO", "SUSPENDIDO", "BAJA"]).optional(),
  statusReason: z.string().optional(),
  reprocannNumber: z.string().optional(),
  reprocannStatus: z.enum(["NO_APORTA", "EN_TRAMITE", "VIGENTE", "VENCIDO", "RECHAZADO"]).optional(),
  reprocannExpiresAt: optionalDate.optional().nullable(),
  consumptionType: z.enum(["LUDICO", "TERAPEUTICO"]).optional(),
  monthlyForecastG: z.number().nonnegative().optional().nullable(),
  consentSignedAt: optionalDate.optional().nullable(),
  phone: z.string().optional(),
  email: z.string().email().or(z.literal("")).optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
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
    return json({ member });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(["ADMIN", "OPERADOR"]);
    const { id } = await ctx.params;
    const body = PatchBody.parse(await req.json());
    const current = await prisma.member.findUnique({ where: { id } });
    if (!current) throw notFound("Socio inexistente");

    const member = await prisma.member.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.status === "ACTIVO" && !current.admittedAt ? { admittedAt: new Date() } : {}),
        ...(body.status === "BAJA" ? { leftAt: new Date() } : {}),
        ...(body.statusReason !== undefined ? { statusReason: body.statusReason } : {}),
        ...(body.reprocannNumber !== undefined ? { reprocannNumber: body.reprocannNumber || null } : {}),
        ...(body.reprocannStatus ? { reprocannStatus: body.reprocannStatus } : {}),
        ...(body.reprocannExpiresAt !== undefined
          ? { reprocannExpiresAt: body.reprocannExpiresAt ? new Date(`${body.reprocannExpiresAt}T00:00:00.000Z`) : null }
          : {}),
        ...(body.consumptionType ? { consumptionType: body.consumptionType } : {}),
        ...(body.monthlyForecastG !== undefined ? { monthlyForecastG: body.monthlyForecastG } : {}),
        ...(body.consentSignedAt !== undefined
          ? { consentSignedAt: body.consentSignedAt ? new Date(`${body.consentSignedAt}T00:00:00.000Z`) : null }
          : {}),
        ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
        ...(body.email !== undefined ? { email: body.email || null } : {}),
        ...(body.address !== undefined ? { address: body.address || null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
      },
    });

    await audit({
      actorId: user.id,
      action: "MEMBER_UPDATE",
      entity: "Member",
      entityId: member.id,
      ip: clientIp(req),
      payload: body,
    });
    return json({ member });
  } catch (error) {
    return fail(error);
  }
}
