import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, requireAnyUser, startSession, verifyPassword } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { badRequest, unauthorized, conflict } from "@/lib/errors";
import { passwordPolicy } from "@/lib/credentials";

const Body = z.object({
  /** Obligatoria salvo que la cuenta no tenga clave todavía (entró siempre con Google). */
  current: z.string().optional(),
  next: z.string().min(1),
});

/**
 * Cambio de clave propio. Sube `tokenVersion`: cualquier sesión abierta con la clave anterior
 * deja de valer, incluso si el token todavía no expiró.
 */
export const POST = route(async (req) => {
  const session = await requireAnyUser();
  const input = await body(req, Body);
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user?.active || user.tokenVersion !== session.tokenVersion) throw unauthorized();
  // Una cuenta creada con Google no tiene clave: la primera se elige, no se verifica.
  if (user.passwordHash) {
    if (!input.current) throw badRequest("CURRENT_REQUIRED", "Escribí tu clave actual.");
    if (!(await verifyPassword(input.current, user.passwordHash))) throw unauthorized("La clave actual no coincide.");
  }

  const policy = passwordPolicy(input.next, input.current ?? "");
  if (!policy.ok) throw badRequest("WEAK_PASSWORD", policy.message);

  const passwordHash = await hashPassword(input.next.trim());
  const updated = await prisma.$transaction(async (tx) => {
    // Compare-and-swap: a concurrent reset must not be overwritten by an old session.
    const changed = await tx.user.updateMany({
      where: { id: user.id, active: true, tokenVersion: user.tokenVersion, passwordHash: user.passwordHash },
      data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date(), tokenVersion: { increment: 1 } },
    });
    if (changed.count !== 1) throw conflict("CREDENTIALS_CHANGED", "Tu acceso cambió mientras guardabas. Volvé a ingresar.");
    const updated = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    await tx.auditLog.create({
      data: { actorId: user.id, action: user.passwordHash ? "PASSWORD_CHANGE" : "PASSWORD_SET", entity: "User", entityId: user.id, ip: clientIp(req) },
    });
    return updated;
  });
  await startSession({ id: updated.id, email: updated.email, name: updated.name, role: updated.role, memberId: updated.memberId }, updated.tokenVersion);
  return { ok: true };
});
