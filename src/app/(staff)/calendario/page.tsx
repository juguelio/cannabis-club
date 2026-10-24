import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import { ScheduleEditor } from "@/components/schedule-editor";

export default async function CalendarioPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [rules, closed] = await Promise.all([
    prisma.scheduleRule.findMany({ orderBy: [{ weekday: "asc" }, { startMin: "asc" }] }),
    prisma.closedDay.findMany({ orderBy: { date: "asc" } }),
  ]);

  return (
    <>
      <PageHead
        title="Calendario del dispensario"
        subtitle="Franjas, cupo por turno y días en que el club no atiende"
      />
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
        closed={closed.map((c) => ({ id: c.id, date: c.date.toISOString().slice(0, 10), reason: c.reason }))}
      />
    </>
  );
}
