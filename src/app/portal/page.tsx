import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { portalOverview } from "@/lib/pickups";
import { addDaysKey, buildSlots, dayKeyOf, slotInstant, type Rule } from "@/lib/appointments";
import { MemberPortal } from "@/components/member-portal";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const session = await getMemberSession();
  if (!session) redirect("/login");

  const overview = await portalOverview(session.memberId);
  const today = dayKeyOf(new Date());

  // primer día abierto desde hoy, para arrancar el selector
  const rules = await prisma.scheduleRule.findMany({ orderBy: [{ weekday: "asc" }, { startMin: "asc" }] });
  let day = today;
  for (let i = 0; i < 10; i += 1) {
    const key = addDaysKey(today, i);
    const weekday = new Date(`${key}T00:00:00.000Z`).getUTCDay();
    if (rules.some((r) => r.weekday === weekday && r.active)) {
      day = key;
      break;
    }
  }

  const appointments = await prisma.appointment.findMany({
    where: { scheduledAt: { gte: slotInstant(day, 0), lt: slotInstant(addDaysKey(day, 1), 0) } },
    select: { id: true, memberId: true, scheduledAt: true, status: true },
  });
  const slots = buildSlots(rules as Rule[], day, appointments).map((s) => ({
    startMin: s.startMin,
    label: s.label,
    free: s.free,
    past: s.past,
    full: s.full,
  }));

  const todayKey = dayKeyOf(new Date()) === day ? day : day;

  return <MemberPortal initial={overview} initialSlots={slots} initialDay={todayKey} />;
}
