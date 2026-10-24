import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, requireUser } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { notFound, unprocessable } from "@/lib/errors";

const Patch = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(["ADMIN", "OPERADOR"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(10, "La contraseña necesita al menos 10 caracteres").max(100).optional(),
});

/**
 * Cambios de cuenta del equipo. Nunca te quedás sin administrador:
 * no se puede desactivar ni degradar al último ADMIN activo, ni a uno mismo.
 */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireUser(["ADMIN"]);
  const input = await body(req, Patch);
  const user = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id } });
    if (!target || target.role === "SOCIO") throw notFound("Cuenta inexistente");
    const losesAdmin = target.role === "ADMIN" && (input.active === false || (input.role && input.role !== "ADMIN"));
    if (losesAdmin && target.id === actor.id) throw unprocessable("SELF_LOCKOUT", "No podés quitarte a vos mismo el rol de administrador ni desactivar tu cuenta.");
    if (losesAdmin) {
      const admins = await tx.user.count({ where: { role: "ADMIN", active: true } });
      if (admins <= 1) throw unprocessable("LAST_ADMIN", "Es el último administrador activo: primero nombrá a otro.");
    }
    const updated = await tx.user.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.role ? { role: input.role } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
      },
      select: { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true, createdAt: true },
    });
    const { password, ...rest } = input;
    await tx.auditLog.create({
      data: { actorId: actor.id, action: "USER_UPDATE", entity: "User", entityId: id, ip: clientIp(req), payload: { ...rest, passwordReset: Boolean(password) } },
    });
    return updated;
  }, { isolationLevel: "Serializable" });
  return { user };
});
