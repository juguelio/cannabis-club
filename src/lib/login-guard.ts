/**
 * Freno a la fuerza bruta en el ingreso, sin tablas nuevas: los intentos fallidos
 * quedan en AuditLog (LOGIN_FAILED) y se cuentan por email en una ventana corta.
 */
import { prisma } from "./db";
import { AppError } from "./errors";

export const MAX_FAILURES = 5;
export const WINDOW_MIN = 15;

export function lockoutDecision(failures: number, oldestFailureAt: Date | null, now = new Date()) {
  if (failures < MAX_FAILURES || !oldestFailureAt) return { locked: false as const };
  const unlockAt = new Date(oldestFailureAt.getTime() + WINDOW_MIN * 60_000);
  const minutes = Math.max(1, Math.ceil((unlockAt.getTime() - now.getTime()) / 60_000));
  return { locked: true as const, minutes };
}

export async function assertNotLocked(email: string) {
  const since = new Date(Date.now() - WINDOW_MIN * 60_000);
  const rows = await prisma.auditLog.findMany({
    where: { action: "LOGIN_FAILED", createdAt: { gte: since }, payload: { path: ["email"], equals: email } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
    take: MAX_FAILURES,
  });
  const decision = lockoutDecision(rows.length, rows[0]?.createdAt ?? null);
  if (decision.locked)
    throw new AppError(429, "TOO_MANY_ATTEMPTS", `Demasiados intentos fallidos. Probá de nuevo en ${decision.minutes} min.`);
}

export async function recordFailure(email: string, ip: string | null) {
  try {
    await prisma.auditLog.create({ data: { action: "LOGIN_FAILED", entity: "User", payload: { email }, ip } });
  } catch (error) {
    console.error("[login-guard] no se pudo registrar el intento", error);
  }
}
