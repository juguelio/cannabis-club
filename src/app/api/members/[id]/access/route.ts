import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword, requireUser } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { conflict, notFound, unprocessable } from "@/lib/errors";

/** Clave temporal legible para dictar en el mostrador (sin 0/O/1/l). */
function tempPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

const Body = z.object({ email: z.string().trim().toLowerCase().email("Email inválido").optional() });

/**
 * Da (o renueva) el acceso del socio al portal. Devuelve la clave temporal UNA sola vez:
 * no se guarda en ningún lado salvo su hash.
 */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireUser(["ADMIN", "OPERADOR"]);
  const input = await body(req, Body);
  const member = await prisma.member.findUnique({ where: { id }, include: { user: true } });
  if (!member) throw notFound("Socio inexistente");
  if (member.status !== "ACTIVO") throw unprocessable("MEMBER_NOT_ACTIVE", "Sólo un socio activo puede tener acceso al portal.");

  const email = input.email ?? member.user?.email ?? member.email?.toLowerCase();
  if (!email) throw unprocessable("EMAIL_REQUIRED", "Cargá un email en el legajo para crear el acceso.");
  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken && taken.memberId !== member.id) throw conflict("EMAIL_TAKEN", "Ese email ya lo usa otra cuenta.");

  const password = tempPassword();
  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    const user = member.user
      ? await tx.user.update({ where: { id: member.user.id }, data: { email, passwordHash, active: true } })
      : await tx.user.create({
          data: { email, name: `${member.firstName} ${member.lastName}`, passwordHash, role: "SOCIO", memberId: member.id },
        });
    await tx.auditLog.create({
      data: { actorId: actor.id, action: member.user ? "PORTAL_RESET" : "PORTAL_GRANT", entity: "Member", entityId: member.id, ip: clientIp(req), payload: { email } },
    });
    return user;
  });
  return { email: user.email, password };
});

/** Quita el acceso al portal (la cuenta queda inactiva, no se borra). */
export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireUser(["ADMIN", "OPERADOR"]);
  const member = await prisma.member.findUnique({ where: { id }, include: { user: true } });
  if (!member?.user) throw notFound("El socio no tiene acceso al portal");
  await prisma.$transaction([
    prisma.user.update({ where: { id: member.user.id }, data: { active: false } }),
    prisma.auditLog.create({ data: { actorId: actor.id, action: "PORTAL_REVOKE", entity: "Member", entityId: member.id, ip: clientIp(req) } }),
  ]);
  return { ok: true };
});
