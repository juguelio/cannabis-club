import { prisma } from "./db";

export async function audit(input: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  payload?: unknown;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        payload: (input.payload ?? undefined) as never,
        ip: input.ip ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] no se pudo registrar", error);
  }
}
