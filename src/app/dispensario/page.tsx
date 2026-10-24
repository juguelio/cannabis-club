import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Chip, PageHead, Section } from "@/components/ui";
import { DispensaryConsole } from "@/components/dispensary-console";
import { VoidButton } from "@/components/forms";
import { fmtDateTime, fmtGrams } from "@/lib/labels";

export default async function DispensarioPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [members, batches, dispensations, club] = await Promise.all([
    prisma.member.findMany({ where: { status: "ACTIVO" }, orderBy: [{ lastName: "asc" }] }),
    prisma.batch.findMany({ where: { stage: "DISPONIBLE" }, include: { strain: true, movements: { select: { type: true, grams: true } } } }),
    prisma.dispensation.findMany({ orderBy: { occurredAt: "desc" }, take: 25, include: { member: true, batch: { include: { strain: true } }, operator: true } }),
    prisma.club.findUnique({ where: { id: "singleton" } }),
  ]);

  const available = batches
    .map((b) => ({
      id: b.id,
      code: b.code,
      strain: b.strain.name,
      thcPct: b.thcPct == null ? null : Number(b.thcPct),
      balanceG:
        Math.round(
          b.movements.reduce(
            (a, m) => a + (["INGRESO", "AJUSTE_POSITIVO", "DISPENSACION_REVERSA"].includes(m.type) ? 1 : -1) * Number(m.grams),
            0,
          ) * 100,
        ) / 100,
    }))
    .filter((b) => b.balanceG > 0);

  return (
    <>
      <PageHead
        title="Dispensario"
        subtitle={`Topes del club: ${fmtGrams(club?.limiteDiarioG ?? 25)}/día · ${fmtGrams(club?.limiteMensualG ?? 50)}/mes${
          club?.thcMaxMenor ? ` · menores de ${club.edadLimiteMenor}: ${fmtGrams(club.limiteMenorG)}/mes y ≤${Number(club.thcMaxMenor)}% THC` : ""
        }`}
      />

      <DispensaryConsole
        members={members.map((m) => ({ id: m.id, legajo: m.legajo, name: `${m.lastName}, ${m.firstName}` }))}
        batches={available}
      />

      <div className="mt-4">
        <Section title="Últimas entregas" subtitle="Libro del día: quién, qué lote, cuántos gramos y quién lo registró">
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Socio</th>
                  <th>Cepa / lote</th>
                  <th className="num">Gramos</th>
                  <th>Operador</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dispensations.map((d) => (
                  <tr key={d.id}>
                    <td className="cell-meta">{fmtDateTime(d.occurredAt)}</td>
                    <td>
                      <div className="cell-main">{d.member.lastName}, {d.member.firstName}</div>
                      <div className="cell-meta">Legajo {d.member.legajo}</div>
                    </td>
                    <td>
                      <div>{d.batch.strain.name}</div>
                      <div className="cell-meta">{d.batch.code}</div>
                    </td>
                    <td className="num tnum">{fmtGrams(d.grams)}</td>
                    <td className="cell-meta">{d.operator.name}</td>
                    <td>{d.voidedAt ? <Chip tone="danger">anulada</Chip> : <Chip tone="ok">vigente</Chip>}</td>
                    <td className="num">{session.role === "ADMIN" && !d.voidedAt ? <VoidButton id={d.id} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dispensations.length === 0 ? <div className="empty">Todavía no hay entregas. La primera queda registrada acá.</div> : null}
          </div>
        </Section>
      </div>
    </>
  );
}
