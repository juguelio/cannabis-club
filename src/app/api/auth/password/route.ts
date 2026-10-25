import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, requireAnyUser, startSession, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { body, route } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { badRequest, unauthorized } from "@/lib/errors";
import { passwordPolicy } from "@/lib/credentials";

const Body = z.object({ current: z.string().min(1), next: z.string().min(1) });

/**
 * Cambio de clave propio. Sube `tokenVersion`: cualquier sesión abierta con la clave anterior
 * deja de valer, incluso si el token todavía no expiró.
 */
export const POST = route(async (req) => {
  const session = await requireAnyUser();
  const input = await body(req, Body);
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) throw unauthorized();
  if (!(await verifyPassword(input.current, user.passwordHash))) throw unauthorized("La clave actual no coincide.");

  const policy = passwordPolicy(input.next, input.current);
  if (!policy.ok) throw badRequest("WEAK_PASSWORD", policy.message);

  const passwordHash = await hashPassword(input.next.trim());
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date(), tokenVersion: { increment: 1 } },
  });
  await startSession({ id: updated.id, email: updated.email, name: updated.name, role: updated.role as never, memberId: updated.memberId }, updated.tokenVersion);
  await audit({ actorId: user.id, action: "PASSWORD_CHANGE", entity: "User", entityId: user.id, ip: clientIp(req) });
  return { ok: true };
});
