import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { portalOverview } from "@/lib/pickups";
import { addDaysKey, buildSlots, dayKeyOf, nextOpenDays, slotInstant, type Rule } from "@/lib/appointments";
import { closedDayKeys } from "@/lib/closed-days";
import { recalledBatchesForMember } from "@/lib/batch-quality";
import { CONSENT_TEXTS, memberConsents } from "@/lib/privacy";
import QRCode from "qrcode";
import { MemberPortal } from "@/components/member-portal";
import { catalogoDelClub } from "@/lib/variedades";

export const metadata = { title: "Mi portal" };

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const session = await getMemberSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/portal/clave");

  const [overview, member, deliveries, recalled, consents, variedades] = await Promise.all([
    portalOverview(session.memberId),
    prisma.member.findUniqueOrThrow({ where: { id: session.memberId }, select: { consentSignedAt: true } }),
    prisma.dispensation.findMany({
      where: { memberId: session.memberId },
      orderBy: { occurredAt: "desc" },
      take: 12,
      select: { id: true, occurredAt: true, grams: true, voidedAt: true, batch: { select: { code: true, strain: { select: { name: true } } } } },
    }),
    recalledBatchesForMember(session.memberId),
    memberConsents(session.memberId),
    catalogoDelClub(),
  ]);
  const today = dayKeyOf(new Date());

  // Primer día con algún horario reservable (si hoy ya cerró, arranca en el próximo).
  const rules = (await prisma.scheduleRule.findMany({ orderBy: [{ weekday: "asc" }, { startMin: "asc" }] })) as Rule[];
  let day = today;
  let slots: { startMin: number; label: string; free: number; past: boolean; full: boolean }[] = [];
  const closed = await closedDayKeys(today, 10);
  for (const key of nextOpenDays(rules, closed, today, 10, 5).map((d) => d.key)) {
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

  return (
    <MemberPortal
      initial={overview}
      recalled={recalled}
      consents={consents.map((c) => ({ ...c, grantedAt: c.grantedAt ? c.grantedAt.toISOString() : null, revokedAt: c.revokedAt ? c.revokedAt.toISOString() : null }))}
      consentTexts={CONSENT_TEXTS}
      initialSlots={slots}
      initialDay={day}
      qr={qr}
      consentDate={member.consentSignedAt?.toISOString() ?? null}
      history={deliveries.map((d) => ({ id: d.id, at: d.occurredAt.toISOString(), grams: Number(d.grams), strain: d.batch.strain.name, batch: d.batch.code, voided: Boolean(d.voidedAt) }))}
      variedades={variedades}
    />
  );
}
