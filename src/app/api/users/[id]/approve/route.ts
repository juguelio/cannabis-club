import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { notFound, unprocessable } from "@/lib/errors";

const Aprobar = z.object({
  /** Legajo a vincular. Obligatorio si el rol es SOCIO: sin legajo no hay acceso al portal. */
  memberId: z.string().min(1).nullish(),
});

/**
 * Aprueba una cuenta pendiente (creada por el ingreso con Google).
 * Activar es decisión del club: acá se vincula el legajo y recién ahí puede entrar.
 */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireUser(["ADMIN"]);
  const input = await body(req, Aprobar);

  const user = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id }, select: { id: true, email: true, role: true, active: true, memberId: true } });
    if (!target) throw notFound("Cuenta inexistente");
    if (target.active) throw unprocessable("ALREADY_ACTIVE", "Esa cuenta ya está habilitada.");

    const memberId = input.memberId ?? target.memberId ?? null;
    if (target.role === "SOCIO") {
      if (!memberId) throw unprocessable("MEMBER_REQUIRED", "Elegí a qué legajo del padrón corresponde esta cuenta.");
      const member = await tx.member.findUnique({ where: { id: memberId }, select: { id: true, email: true, user: { select: { id: true } } } });
      if (!member) throw notFound("Socio inexistente");
      if (member.user && member.user.id !== target.id) throw unprocessable("MEMBER_TAKEN", "Ese legajo ya tiene una cuenta de acceso.");
    }

    const updated = await tx.user.update({
      where: { id },
      data: { active: true, ...(memberId ? { memberId } : {}) },
      select: { id: true, email: true, name: true, role: true, active: true, memberId: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "USER_APPROVE",
        entity: "User",
        entityId: updated.id,
        ip: clientIp(req),
        payload: { email: updated.email, role: updated.role, memberId: updated.memberId },
      },
    });
    return updated;
  });

  return { user };
});

/** Rechaza una cuenta pendiente: se borra sin dejar acceso a medias. */
export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireUser(["ADMIN"]);
  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id }, select: { id: true, email: true, active: true } });
    if (!target) throw notFound("Cuenta inexistente");
    if (target.active) throw unprocessable("IS_ACTIVE", "Esa cuenta está habilitada: desactivala desde el equipo, no la borres.");
    await tx.user.delete({ where: { id } });
    await tx.auditLog.create({
      data: { actorId: actor.id, action: "USER_REJECT", entity: "User", entityId: id, ip: clientIp(req), payload: { email: target.email } },
    });
  });
  return { ok: true };
});
