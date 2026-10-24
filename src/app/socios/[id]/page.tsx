import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { MemberActions } from "@/components/forms";

const fdate = (d: Date | null) => (d ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "UTC" }).format(d) : "—");
const fdt = (d: Date) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(d);

export default async function SocioDetalle({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      dispensations: { orderBy: { occurredAt: "desc" }, take: 50, include: { batch: { include: { strain: true } }, operator: true } },
    },
  });
  if (!member) notFound();

  const total = member.dispensations.filter((d) => !d.voidedAt).reduce((a, d) => a + Number(d.grams), 0);
  const last = member.dispensations[0];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{member.lastName}, {member.firstName}</h1>
          <p className="muted text-sm">Legajo {member.legajo} · {member.docType} {member.docNumber} · {member.status}</p>
        </div>
        <div className="flex items-center gap-2">
          <MemberActions id={member.id} status={member.status} />
          <Link className="btn btn-ghost" href="/socios">Volver</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card p-4 text-sm space-y-1">
          <div className="muted text-xs">Datos</div>
          <div>Nacimiento: {fdate(member.birthDate)}</div>
          <div>Domicilio: {member.address ?? "—"}</div>
          <div>Teléfono: {member.phone ?? "—"}</div>
          <div>Email: {member.email ?? "—"}</div>
        </div>
        <div className="card p-4 text-sm space-y-1">
          <div className="muted text-xs">REPROCANN</div>
          <div>Número: {member.reprocannNumber ?? "—"}</div>
          <div>Estado: {member.reprocannStatus}</div>
          <div>Vence: {fdate(member.reprocannExpiresAt)}</div>
          <div>Consumo: {member.consumptionType} · previsión {member.monthlyForecastG ? `${Number(member.monthlyForecastG)} g/mes` : "—"}</div>
        </div>
        <div className="card p-4 text-sm space-y-1">
          <div className="muted text-xs">Registro</div>
          <div>Alta: {fdate(member.admittedAt)}</div>
          <div>Consentimiento: {fdate(member.consentSignedAt)}</div>
          <div>Entregado histórico: {Math.round(total * 100) / 100} g</div>
          <div>Última entrega: {last ? fdt(last.occurredAt) : "—"}</div>
        </div>
      </div>

      <section className="card p-4">
        <h2 className="font-semibold mb-3">Entregas</h2>
        <table className="data">
          <thead>
            <tr><th>Fecha</th><th>Cepa / lote</th><th>Gramos</th><th>THC</th><th>Operador</th><th>Firma</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {member.dispensations.map((d) => (
              <tr key={d.id}>
                <td>{fdt(d.occurredAt)}</td>
                <td>{d.batch.strain.name} · {d.batch.code}</td>
                <td>{Number(d.grams)} g</td>
                <td>{d.thcPct ? `${Number(d.thcPct)}%` : "—"}</td>
                <td>{d.operator.name}</td>
                <td>{d.signatureType}</td>
                <td>{d.voidedAt ? <span className="badge">anulada</span> : <span className="badge">vigente</span>}</td>
              </tr>
            ))}
            {member.dispensations.length === 0 ? <tr><td colSpan={7} className="muted">Sin entregas registradas.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
