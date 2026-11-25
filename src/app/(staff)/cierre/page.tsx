import { Input, ValidatedForm } from "@/components/validated-form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Chip, Empty, Field, PageHead, Section } from "@/components/ui";
import { auditAction, fmtGrams } from "@/lib/labels";

const TZ = "America/Argentina/Buenos_Aires";
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

export default async function CierrePage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const dia = sp?.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : dayKey(new Date());
  const start = new Date(`${dia}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [entregas, movimientos, reservas, auditoria, previo] = await Promise.all([
    prisma.dispensation.findMany({
      where: { occurredAt: { gte: start, lt: end } },
      include: { member: true, batch: { include: { strain: true } }, operator: true },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.stockMovement.findMany({
      where: { occurredAt: { gte: start, lt: end } },
      include: { batch: { include: { strain: true } }, actor: true },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.pickupRequest.findMany({
      where: { fulfilledAt: { gte: start, lt: end } },
      include: { member: true },
      orderBy: { fulfilledAt: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: start, lt: end } },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.dispensation.findMany({
      where: { occurredAt: { lt: start } },
      select: { grams: true, voidedAt: true },
    }),
  ]);

  const vigentes = entregas.filter((d) => !d.voidedAt);
  const anuladas = entregas.filter((d) => d.voidedAt);
  const neto = Math.round(vigentes.reduce((a, d) => a + Number(d.grams), 0) * 100) / 100;
  const gramosAnulados = Math.round(anuladas.reduce((a, d) => a + Number(d.grams), 0) * 100) / 100;
  const acumulado =
    Math.round(
      (previo.filter((d) => !d.voidedAt).reduce((a, d) => a + Number(d.grams), 0)) * 100,
    ) / 100;

  return (
    <>
      <PageHead
        title="Cierre del día"
        subtitle={`${dia} · entregas, stock y auditoría del dispensario`}
        actions={
          <ValidatedForm method="get" className="flex items-center gap-2">
            <Input className="input" type="date" name="d" defaultValue={dia} aria-label="Día a cerrar" />
            <button className="btn btn-secondary">Ver</button>
          </ValidatedForm>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="card card-pad"><Field label="Entregas vigentes" value={`${vigentes.length} · ${fmtGrams(neto)}`} /></div>
        <div className="card card-pad"><Field label="Anuladas" value={`${anuladas.length} · ${fmtGrams(gramosAnulados)}`} /></div>
        <div className="card card-pad"><Field label="Reservas retiradas" value={reservas.length} /></div>
        <div className="card card-pad"><Field label="Entregado antes de este día" value={fmtGrams(acumulado)} /></div>
      </div>

      <Section title="Entregas del día" subtitle="Incluye las anuladas: el cierre no esconde correcciones">
        {entregas.length === 0 ? (
          <Empty>No hubo entregas ese día.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Socio</th>
                  <th>Lote</th>
                  <th>Gramos</th>
                  <th>Operador</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {entregas.map((d) => (
                  <tr key={d.id}>
                    <td className="cell-meta">{new Intl.DateTimeFormat("es-AR", { timeStyle: "short", timeZone: TZ }).format(d.occurredAt)}</td>
                    <td>{d.member.legajo} · {d.member.lastName}, {d.member.firstName}</td>
                    <td className="cell-meta">{d.batch.code} · {d.batch.strain.name}</td>
                    <td className="tnum">{fmtGrams(d.grams)}</td>
                    <td className="cell-meta">{d.operator?.name ?? "—"}</td>
                    <td>{d.voidedAt ? <Chip tone="warn">Anulada</Chip> : <Chip tone="ok">Vigente</Chip>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Movimientos de stock" subtitle="Ingresos, ajustes, dispensaciones, reversas y destrucciones">
          {movimientos.length === 0 ? (
            <Empty>Sin movimientos ese día.</Empty>
          ) : (
            <table className="data">
              <thead>
                <tr><th>Hora</th><th>Lote</th><th>Tipo</th><th>Gramos</th></tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id}>
                    <td className="cell-meta">{new Intl.DateTimeFormat("es-AR", { timeStyle: "short", timeZone: TZ }).format(m.occurredAt)}</td>
                    <td className="cell-meta">{m.batch.code}</td>
                    <td>{m.type}</td>
                    <td className="tnum">{fmtGrams(m.grams)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Auditoría del día" subtitle="Quién hizo qué, sobre qué registro">
          {auditoria.length === 0 ? (
            <Empty>Sin eventos de auditoría ese día.</Empty>
          ) : (
            <table className="data">
              <thead>
                <tr><th>Hora</th><th>Acción</th><th>Entidad</th><th>Quién</th></tr>
              </thead>
              <tbody>
                {auditoria.map((a) => (
                  <tr key={a.id}>
                    <td className="cell-meta">{new Intl.DateTimeFormat("es-AR", { timeStyle: "short", timeZone: TZ }).format(a.createdAt)}</td>
                    <td>{auditAction(a.action)}</td>
                    <td className="cell-meta">{a.entity}</td>
                    <td className="cell-meta">{a.actor?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <Section title="Cerrar el mes" subtitle="El libro completo, en CSV, para presentar o archivar">
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-secondary btn-sm" href={`/api/reports/dispensaciones`}>Libro de dispensaciones</Link>
          <Link className="btn btn-secondary btn-sm" href={`/api/reports/stock`}>Stock por lote</Link>
          <Link className="btn btn-secondary btn-sm" href={`/api/reports/destrucciones`}>Destrucciones</Link>
          <Link className="btn btn-secondary btn-sm" href={`/reportes?year=${dia.slice(0, 4)}`}>Informe anual</Link>
        </div>
      </Section>
    </>
  );
}
