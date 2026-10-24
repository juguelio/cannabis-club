import { requireMember } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { addDaysKey, buildSlots, dayKeyOf, slotInstant, type Rule } from "@/lib/appointments";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const OPEN_DAYS = 10;

/** Grilla pública del socio: sólo horas libres, sin datos de otros turnos. */
export async function GET(req: Request) {
  try {
    const member = await requireMember();
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const day = date && DAY.test(date) ? date : dayKeyOf(new Date());

    const [rules, appointments] = await Promise.all([
      prisma.scheduleRule.findMany({ orderBy: [{ weekday: "asc" }, { startMin: "asc" }] }),
      prisma.appointment.findMany({
        where: { scheduledAt: { gte: slotInstant(day, 0), lt: slotInstant(addDaysKey(day, 1), 0) } },
        select: { id: true, memberId: true, scheduledAt: true, status: true },
      }),
    ]);

    const slots = buildSlots(rules as Rule[], day, appointments);
    const mine = appointments.filter((a) => a.memberId === member.memberId && a.status !== "CANCELADO");

    // próximos días abiertos, para el selector
    const today = dayKeyOf(new Date());
    const days: { key: string; weekday: number }[] = [];
    for (let i = 0; i < OPEN_DAYS && days.length < 5; i += 1) {
      const key = addDaysKey(today, i);
      const weekday = new Date(`${key}T00:00:00.000Z`).getUTCDay();
      const hasRule = rules.some((r) => r.weekday === weekday && r.active);
      // Hoy sólo cuenta si todavía queda algún horario por delante.
      const stillOpen = i > 0 || buildSlots(rules as Rule[], key, []).some((s) => !s.past);
      if (hasRule && stillOpen) days.push({ key, weekday });
    }

    return json({
      day,
      slots: slots.map((s) => ({ startMin: s.startMin, label: s.label, at: s.at, free: s.free, past: s.past, full: s.full })),
      days,
      alreadyBookedToday: mine.length > 0,
    });
  } catch (error) {
    return fail(error);
  }
}
