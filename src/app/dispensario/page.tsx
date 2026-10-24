import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DispenseForm, VoidButton } from "@/components/forms";

const fdt = (d: Date) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(d);

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
    .map((b) => {
      const balance = b.movements.reduce(
        (a, m) => a + (["INGRESO", "AJUSTE_POSITIVO", "DISPENSACION_REVERSA"].includes(m.type) ? 1 : -1) * Number(m.grams),
        0,
      );
      return { id: b.id, code: b.code, strain: b.strain.name, thcPct: b.thcPct == null ? null : Number(b.thcPct), balanceG: Math.round(balance * 100) / 100 };
    })
    .filter((b) => b.balanceG > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Dispensario</h1>
        <p className="muted text-sm">
          Topes vigentes: {Number(club?.limiteDiarioG ?? 25)} g/día · {Number(club?.limiteMensualG ?? 50)} g/mes
          {club?.thcMaxMenor ? ` · menores de ${club.edadLimiteMenor}: ${Number(club.limiteMenorG)} g/mes y ≤${Number(club.thcMaxMenor)}% THC` : ""}.
          La validación ocurre en la misma transacción que descuenta el stock.
        </p>
      </div>

      <DispenseForm
        members={members.map((m) => ({ id: m.id, legajo: m.legajo, lastName: m.lastName, firstName: m.firstName }))}
        batches={available}
      />

      <section className="card p-4 overflow-x-auto">
        <h2 className="font-semibold mb-3">Últimas entregas</h2>
        <table className="data">
          <thead>
            <tr><th>Fecha</th><th>Socio</th><th>Cepa / lote</th><th>Gramos</th><th>Operador</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {dispensations.map((d) => (
              <tr key={d.id}>
                <td>{fdt(d.occurredAt)}</td>
                <td>{d.member.lastName}, {d.member.firstName}</td>
                <td>{d.batch.strain.name} · {d.batch.code}</td>
                <td>{Number(d.grams)} g</td>
                <td>{d.operator.name}</td>
                <td>{d.voidedAt ? <span className="badge">anulada</span> : <span className="badge">vigente</span>}</td>
                <td>{session.role === "ADMIN" && !d.voidedAt ? <VoidButton id={d.id} /> : null}</td>
              </tr>
            ))}
            {dispensations.length === 0 ? <tr><td colSpan={7} className="muted">Sin entregas.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
