import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, requireUser } from "@/lib/auth";
import { ROLES_EQUIPO } from "@/lib/roles";
import { body, created, route } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { conflict } from "@/lib/errors";

const select = { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true, createdAt: true } as const;

/** Equipo del club (staff). Las cuentas de socios se gestionan desde su legajo. */
export const GET = route(async () => {
  await requireUser(["ADMIN"]);
  const users = await prisma.user.findMany({ where: { role: { in: ROLES_EQUIPO } }, orderBy: [{ active: "desc" }, { name: "asc" }], select });
  return { users };
});

const Create = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  role: z.enum(["ADMIN", "OPERADOR", "DISPENSADOR"]),
  password: z.string().min(10, "La contraseña necesita al menos 10 caracteres").max(100),
});

export const POST = route(async (req) => {
  const actor = await requireUser(["ADMIN"]);
  const input = await body(req, Create);
  if (await prisma.user.findUnique({ where: { email: input.email } })) throw conflict("EMAIL_TAKEN", "Ya existe una cuenta con ese email.");
  const user = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: input.name, email: input.email, role: input.role, passwordHash: await hashPassword(input.password), mustChangePassword: true, passwordChangedAt: new Date() },
      select,
    });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "USER_CREATE", entity: "User", entityId: user.id, ip: clientIp(req), payload: { email: user.email, role: user.role } } });
    return user;
  });
  return created({ user });
});
