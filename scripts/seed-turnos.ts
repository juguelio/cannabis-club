/**
 * Franjas de atención + turnos de demo, sin borrar nada.
 * Uso: DATABASE_URL="..." npx tsx scripts/seed-turnos.ts
 * Idempotente: no duplica franjas ni turnos existentes.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OPEN_MIN = 10 * 60;
const CLOSE_MIN = 19 * 60;
const SLOT_MIN = 20;
const CAPACITY = 2;

async function main() {
  // 1) franjas: lunes a sábado, 10:00–19:00, turnos de 20 minutos, cupo 2
  let rules = 0;
  for (let weekday = 1; weekday <= 6; weekday += 1) {
    const existing = await prisma.scheduleRule.findFirst({ where: { weekday, startMin: OPEN_MIN } });
    if (existing) {
      await prisma.scheduleRule.update({
        where: { id: existing.id },
        data: { endMin: CLOSE_MIN, slotMin: SLOT_MIN, capacity: CAPACITY, active: true },
      });
    } else {
      await prisma.scheduleRule.create({
        data: { weekday, startMin: OPEN_MIN, endMin: CLOSE_MIN, slotMin: SLOT_MIN, capacity: CAPACITY },
      });
      rules += 1;
    }
  }
  console.log(`franjas: ${rules} creadas, ${6 - rules} ya existían`);

  // 2) próximo día hábil (mañana en adelante) para que la demo tenga turnos futuros
  const clubDay = (d: Date) => new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const target = clubDay(new Date());
  target.setUTCDate(target.getUTCDate() + 1);
  for (let i = 0; i < 7; i += 1) {
    const weekday = target.getUTCDay();
    if (weekday >= 1 && weekday <= 6) break;
    target.setUTCDate(target.getUTCDate() + 1);
  }
  const dayKey = target.toISOString().slice(0, 10);
  const midnight = new Date(`${dayKey}T00:00:00-03:00`);
  const at = (minutes: number) => new Date(midnight.getTime() + minutes * 60_000);

  const already = await prisma.appointment.count({
    where: { scheduledAt: { gte: midnight, lt: new Date(midnight.getTime() + 24 * 60 * 60 * 1000) } },
  });
  if (already > 0) {
    console.log(`turnos: ya hay ${already} el ${dayKey}, no toco nada`);
    return;
  }

  const members = await prisma.member.findMany({
    where: { status: "ACTIVO" },
    orderBy: { legajo: "asc" },
    take: 3,
  });
  if (members.length === 0) {
    console.log("turnos: no hay socios activos, no creo turnos");
    return;
  }

  const operator = await prisma.user.findFirst({ where: { role: { in: ["ADMIN", "OPERADOR"] } } });
  const plan = [
    { minutes: 10 * 60 + 20, status: "CONFIRMADO" as const, channel: "WHATSAPP" },
    { minutes: 11 * 60, status: "PENDIENTE" as const, channel: "TELEFONO" },
    { minutes: 16 * 60, status: "PENDIENTE" as const, channel: "MOSTRADOR" },
  ];

  for (let i = 0; i < Math.min(plan.length, members.length); i += 1) {
    await prisma.appointment.create({
      data: {
        memberId: members[i].id,
        scheduledAt: at(plan[i].minutes),
        status: plan[i].status,
        channel: plan[i].channel,
        operatorId: operator?.id,
        createdById: operator?.id,
        durationMin: SLOT_MIN,
      },
    });
  }
  console.log(`turnos: ${Math.min(plan.length, members.length)} creados para el ${dayKey}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
