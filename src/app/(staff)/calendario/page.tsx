import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import { ScheduleEditor } from "@/components/schedule-editor";
import { CalendarioClub } from "@/components/calendario-club";
import { rangeBoard } from "@/lib/appointments-db";
import { dayKeyOf, gridDays } from "@/lib/appointments";

export const metadata = { title: "Calendario" };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const hoy = dayKeyOf(new Date());
  const ancla = sp.fecha && DAY.test(sp.fecha) ? sp.fecha : hoy;

  // El calendario abre en la semana del ancla; los días cerrados se manejan desde el mismo panel.
  const keys = gridDays(ancla, "semana");
  const [dias, rules, closed] = await Promise.all([
    rangeBoard(keys[0], keys[keys.length - 1]),
    prisma.scheduleRule.findMany({ orderBy: [{ weekday: "asc" }, { startMin: "asc" }] }),
    prisma.closedDay.findMany({ orderBy: { date: "asc" } }),
  ]);

  return (
    <>
      <PageHead
        title="Calendario del dispensario"
        subtitle="Qué hay cada día, quién viene y qué días el club no atiende. Los socios reservan desde el portal."
      />
      <CalendarioClub
        inicial={dias}
        desde={keys[0]}
        hasta={keys[keys.length - 1]}
        hoy={hoy}
        cerrados={closed.map((c) => ({ id: c.id, date: c.date.toISOString().slice(0, 10), reason: c.reason }))}
      />

      <details className="card card-pad" style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 650 }}>Franjas de atención y cupos</summary>
        <div style={{ marginTop: 12 }}>
          <ScheduleEditor
            rules={rules.map((r) => ({
              id: r.id,
              weekday: r.weekday,
              startMin: r.startMin,
              endMin: r.endMin,
              slotMin: r.slotMin,
              capacity: r.capacity,
              active: r.active,
            }))}
            closed={[]}
          />
        </div>
      </details>
    </>
  );
}
