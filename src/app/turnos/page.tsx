import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import { AppointmentsBoard } from "@/components/appointments-board";
import { dayBoard } from "@/lib/appointments-db";
import { dayKeyOf } from "@/lib/appointments";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default async function TurnosPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const today = dayKeyOf(new Date());
  const day = sp.date && DAY.test(sp.date) ? sp.date : today;

  const [board, members] = await Promise.all([
    dayBoard(day),
    prisma.member.findMany({
      where: { status: "ACTIVO" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, legajo: true, firstName: true, lastName: true },
    }),
  ]);

  return (
    <>
      <PageHead
        title="Turnos"
        subtitle="Franjas de atención, cupo por turno y registro de quién vino. Reservar no habilita la entrega."
      />
      <AppointmentsBoard
        initial={board}
        today={today}
        members={members.map((m) => ({ id: m.id, legajo: m.legajo, name: `${m.lastName}, ${m.firstName}` }))}
      />
    </>
  );
}
