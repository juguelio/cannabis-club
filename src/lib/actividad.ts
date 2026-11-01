import { prisma } from "./db";
import { AUDIT_SESSION } from "./labels";

/**
 * Actividad del club para las pantallas de lectura (modo inspección).
 *
 * Los ingresos al panel se cuentan aparte a propósito: son la mayoría de las filas y
 * dejan abajo lo que de verdad pasó (entregas, altas, cierres). El corte de 24 h se
 * calcula acá y no en el componente, que tiene que quedar puro.
 */
export const ACTIVIDAD_TOPE = 10;

export async function actividadReciente(tope = ACTIVIDAD_TOPE) {
  const [acciones, ingresos] = await Promise.all([
    prisma.auditLog.findMany({
      where: { action: { notIn: [...AUDIT_SESSION] } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: tope,
      include: { actor: { select: { name: true } } },
    }),
    prisma.auditLog.count({
      where: { action: { in: [...AUDIT_SESSION] }, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    }),
  ]);
  return { acciones, ingresos };
}
