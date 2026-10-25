import { requireMember } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { addDaysKey, buildSlots, dayKeyOf, nextOpenDays, slotInstant, type Rule } from "@/lib/appointments";
import { closedDayKeys } from "@/lib/closed-days";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const OPEN_DAYS = 10;

/** Grilla pública del socio: sólo horas libres, sin datos de otros turnos. */
export async function GET(req: Request) {
  try {
    const member = await requireMember();
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const day = date && DAY.test(date) ? date : dayKeyOf(new Date());

    const today = dayKeyOf(new Date());
    const closed = await closedDayKeys(today, OPEN_DAYS + 1);
    const isClosed = closed.has(day);

    const [rules, appointments] = await Promise.all([
      prisma.scheduleRule.findMany({ orderBy: [{ weekday: "asc" }, { startMin: "asc" }] }),
      prisma.appointment.findMany({
        where: { scheduledAt: { gte: slotInstant(day, 0), lt: slotInstant(addDaysKey(day, 1), 0) } },
        select: { id: true, memberId: true, scheduledAt: true, status: true },
      }),
    ]);

    // Un día cerrado no ofrece horarios: el club no atiende, aunque la franja exista.
    const slots = isClosed ? [] : buildSlots(rules as Rule[], day, appointments);
    const mine = appointments.filter((a) => a.memberId === member.memberId && a.status !== "CANCELADO");

    // próximos días abiertos, para el selector (los cerrados no aparecen)
    const days = nextOpenDays(rules as Rule[], closed, today, OPEN_DAYS, 5);

    return json({
      day,
      slots: slots.map((s) => ({ startMin: s.startMin, label: s.label, at: s.at, free: s.free, past: s.past, full: s.full })),
      days,
      closed: isClosed,
      alreadyBookedToday: mine.length > 0,
    });
  } catch (error) {
    return fail(error);
  }
}
