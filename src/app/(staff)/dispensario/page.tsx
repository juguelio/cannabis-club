import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, Scale } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getClub } from "@/lib/club";
import { batchesWithTotals } from "@/lib/stock";
import { listPickups } from "@/lib/pickups";
import { addDaysKey, dayKeyOf, labelOf, slotInstant } from "@/lib/appointments";
import { Chip, Empty, PageHead, Panel } from "@/components/ui";
import { DispensaryConsole } from "@/components/dispensary-console";
import { PickupActions } from "@/components/pickup-actions";
import { VoidButton } from "@/components/forms";
import { fmtGrams, fmtWhen } from "@/lib/labels";

export const metadata = { title: "Dispensario" };
const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export default async function DispensarioPage({ searchParams }: { searchParams: Promise<{ socio?: string; pickup?: string; libro?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const today = dayKeyOf(new Date());
  const onlyToday = sp.libro !== "todo";

  const [pickups, members, batches, dispensations, club, appts] = await Promise.all([
    listPickups(),
    prisma.member.findMany({ where: { status: "ACTIVO" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, legajo: true, firstName: true, lastName: true, docLast4: true } }),
    batchesWithTotals({ stage: "DISPONIBLE" }),
    prisma.dispensation.findMany({
      where: onlyToday ? { occurredAt: { gte: slotInstant(today, 0) } } : {},
      orderBy: { occurredAt: "desc" },
      take: onlyToday ? 200 : 60,
      include: { member: { select: { id: true, legajo: true, firstName: true, lastName: true } }, batch: { include: { strain: true } }, operator: { select: { name: true } } },
    }),
    getClub(),
    prisma.appointment.findMany({
      where: { scheduledAt: { gte: slotInstant(today, 0), lt: slotInstant(addDaysKey(today, 1), 0) }, status: { in: ["PENDIENTE", "CONFIRMADO"] } },
      include: { member: { select: { id: true, legajo: true, firstName: true, lastName: true, status: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  // Cola del día: turnos de hoy + reservas abiertas (una fila por socio).
  const pickupByMember = new Map(pickups.map((p) => [p.memberId, p]));
  type Item = { id: string; strainId: string; strainName: string; grams: number };
  type Q = { key: string; memberId: string; time: string | null; name: string; legajo: number; pickupId: string | null; pickupG: number | null; pickupItems: Item[]; status: string };
  const queue: Q[] = appts
    .filter((a) => a.member.status === "ACTIVO")
    .map((a) => {
      const p = pickupByMember.get(a.memberId);
      return {
        key: a.id,
        memberId: a.memberId,
        time: labelOf(a.scheduledAt),
        name: `${a.member.lastName}, ${a.member.firstName}`,
        legajo: a.member.legajo,
        pickupId: p?.id ?? null,
        pickupG: p?.grams ?? null,
        pickupItems: p?.items ?? [],
        status: a.status,
      };
    });
  for (const p of pickups) {
    if (!queue.some((q) => q.memberId === p.memberId) && (!p.pickupAt || dayKeyOf(p.pickupAt) <= today)) {
      queue.push({ key: p.id, memberId: p.memberId, time: null, name: p.memberName, legajo: p.legajo, pickupId: p.id, pickupG: p.grams, pickupItems: p.items, status: p.status });
    }
  }

  const available = batches.filter((b) => b.totals.balanceG > 0).map((b) => ({
    id: b.id, code: b.code, strain: b.strain.name, strainId: b.strainId, balanceG: b.totals.balanceG, thcPct: b.thcPct == null ? null : Number(b.thcPct),
  }));
  const deliveredToday = dispensations.filter((d) => !d.voidedAt && d.occurredAt >= slotInstant(today, 0)).reduce((a, d) => a + Number(d.grams), 0);
  const minorRule = club.thcMaxMenor ? ` Menores de ${club.edadLimiteMenor}: ${fmtGrams(club.limiteMenorG)} por mes y hasta ${Number(club.thcMaxMenor)}% THC.` : "";
  // Desglose de la reserva: es lo que el mostrador imputa. Sin ítems (reserva vieja o carga manual) queda vacío.
  const itemsLabel = (items: Item[]) => items.map((i) => `${fmtGrams(i.grams)} ${i.strainName}`).join(" · ");

  return (
    <>
      <PageHead
        title="Dispensario"
        subtitle={`Topes del club: ${fmtGrams(club.limitePorPedidoG)} por pedido y ${fmtGrams(club.limiteMensualG)} por mes.${minorRule} Cada entrega se valida otra vez al confirmar.`}
      />

      <DispensaryConsole
        members={members.map((m) => ({ id: m.id, legajo: m.legajo, name: `${m.lastName}, ${m.firstName}`, docLast4: m.docLast4 }))}
        batches={available}
        queue={queue}
        initialMemberId={sp?.socio}
        initialPickupId={sp?.pickup}
      />

      <div className="stack" style={{ marginTop: 16 }}>
        <Panel title="Reservas del portal" subtitle="Lo que los socios reservaron desde el celular. Confirmar les avisa; el retiro se registra como entrega y cierra la reserva sola.">
          {pickups.length === 0 ? (
            <Empty icon={Inbox}>No hay reservas abiertas.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Socio</th><th className="num">Gramos</th><th>Retira</th><th className="hide-sm">Aporte estimado</th><th>Estado</th><th /></tr>
                </thead>
                <tbody>
                  {pickups.map((p) => (
                    <tr key={p.id}>
                      <td><Link className="row-link" href={`/socios/${p.memberId}`}><div className="cell-main">{p.memberName}</div><div className="cell-meta">Legajo {p.legajo}</div></Link></td>
                      <td className="num">
                        <div className="cell-main tnum">{fmtGrams(p.grams)}</div>
                        {p.items.length ? <div className="cell-meta">{itemsLabel(p.items)}</div> : null}
                      </td>
                      <td className="cell-meta">{p.pickupAt ? fmtWhen(p.pickupAt) : "sin horario"}</td>
                      <td className="tnum hide-sm">{p.aporteEstimado != null ? MONEY.format(p.aporteEstimado) : "—"}</td>
                      <td><Chip tone={p.status === "CONFIRMADA" ? "ok" : "brand"}>{p.status === "CONFIRMADA" ? "Confirmada" : "Por confirmar"}</Chip></td>
                      <td className="num"><PickupActions id={p.id} status={p.status} memberId={p.memberId} puedeForzar={session.role === "ADMIN"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          id="libro"
          title={onlyToday ? "Libro de hoy" : "Libro de entregas"}
          subtitle={onlyToday ? `${fmtGrams(Math.round(deliveredToday * 100) / 100)} entregados hoy, neto de anulaciones.` : "Las últimas 60 entregas. El libro completo se descarga en Libros."}
          action={
            <nav className="seg" aria-label="Período">
              <Link href="/dispensario#libro" aria-current={onlyToday ? "true" : undefined}>Hoy</Link>
              <Link href="/dispensario?libro=todo#libro" aria-current={!onlyToday ? "true" : undefined}>Recientes</Link>
            </nav>
          }
        >
          {dispensations.length === 0 ? (
            <Empty icon={Scale}>{onlyToday ? "Todavía no hubo entregas hoy." : "Todavía no hay entregas."}</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Cuándo</th><th>Socio</th><th>Lote</th><th className="num">Gramos</th><th className="hide-sm">Registró</th><th /></tr>
                </thead>
                <tbody>
                  {dispensations.map((d) => (
                    <tr key={d.id} className={d.voidedAt ? "voided" : undefined}>
                      <td className="cell-meta" style={{ whiteSpace: "nowrap" }}>{fmtWhen(d.occurredAt)}</td>
                      <td><Link className="row-link" href={`/socios/${d.member.id}`}><div className="cell-main">{d.member.lastName}, {d.member.firstName}</div><div className="cell-meta">Legajo {d.member.legajo}</div></Link></td>
                      <td><div>{d.batch.strain.name}</div><div className="cell-meta">{d.batch.code}</div></td>
                      <td className="num"><span className="cell-main tnum">{fmtGrams(d.grams)}</span>{d.voidedAt ? <div className="cell-meta" title={d.voidReason ?? ""}>anulada</div> : null}</td>
                      <td className="cell-meta hide-sm">{d.operator.name}</td>
                      <td className="num">{session.role === "ADMIN" && !d.voidedAt ? <VoidButton id={d.id} label={`${fmtGrams(d.grams)} a ${d.member.lastName}`} /> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
