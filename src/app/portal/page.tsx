import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { portalOverview } from "@/lib/pickups";
import { addDaysKey, buildSlots, dayKeyOf, slotInstant, type Rule } from "@/lib/appointments";
import QRCode from "qrcode";
import { MemberPortal } from "@/components/member-portal";

export const metadata = { title: "Mi portal" };

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const session = await getMemberSession();
  if (!session) redirect("/login");

  const overview = await portalOverview(session.memberId);
  const today = dayKeyOf(new Date());

  // Primer día con algún horario reservable (si hoy ya cerró, arranca en el próximo).
  const rules = (await prisma.scheduleRule.findMany({ orderBy: [{ weekday: "asc" }, { startMin: "asc" }] })) as Rule[];
  let day = today;
  let slots: { startMin: number; label: string; free: number; past: boolean; full: boolean }[] = [];
  for (let i = 0; i < 10; i += 1) {
    const key = addDaysKey(today, i);
    const weekday = new Date(`${key}T00:00:00.000Z`).getUTCDay();
    if (!rules.some((r) => r.weekday === weekday && r.active)) continue;
    const appointments = await prisma.appointment.findMany({
      where: { scheduledAt: { gte: slotInstant(key, 0), lt: slotInstant(addDaysKey(key, 1), 0) } },
      select: { id: true, memberId: true, scheduledAt: true, status: true },
    });
    const built = buildSlots(rules, key, appointments).map((s) => ({ startMin: s.startMin, label: s.label, free: s.free, past: s.past, full: s.full }));
    if (built.some((s) => !s.past && !s.full)) {
      day = key;
      slots = built;
      break;
    }
  }

  const base = process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "";
  const qr = await QRCode.toString(`${base}/dispensario?socio=${session.memberId}`, { type: "svg", margin: 0, color: { dark: "#10231b", light: "#ffffff" } });

  return <MemberPortal initial={overview} initialSlots={slots} initialDay={day} qr={qr} />;
}
