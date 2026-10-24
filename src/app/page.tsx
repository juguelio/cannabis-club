import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Chip, Empty, PageHead, Section } from "@/components/ui";
import { fmtDateTime, fmtGrams, reprocannIssue, STAGE } from "@/lib/labels";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [activos, total, pendientes, conProblema, stock, lotes, ultimas, hoy, club] = await Promise.all([
    prisma.member.count({ where: { status: "ACTIVO" } }),
    prisma.member.count(),
    prisma.member.count({ where: { status: "PENDIENTE" } }),
    prisma.member.findMany({
      where: { status: "ACTIVO", OR: [{ reprocannStatus: { not: "VIGENTE" } }, { reprocannExpiresAt: { lt: new Date() } }] },
      orderBy: { reprocannExpiresAt: "asc" },
      take: 4,
    }),
    prisma.$queryRaw<{ total: unknown }[]>`
      SELECT COALESCE(SUM(CASE WHEN type IN ('INGRESO','AJUSTE_POSITIVO','DISPENSACION_REVERSA') THEN grams ELSE -grams END),0) AS total
      FROM "StockMovement"`,
    prisma.batch.findMany({ where: { stage: "DISPONIBLE" }, include: { strain: true, movements: { select: { type: true, grams: true } } }, orderBy: { code: "desc" } }),
    prisma.dispensation.findMany({ take: 6, orderBy: { occurredAt: "desc" }, include: { member: true, batch: { include: { strain: true } } } }),
    prisma.$queryRaw<{ grams: unknown }[]>`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'DISPENSACION' THEN grams ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN type = 'DISPENSACION_REVERSA' THEN grams ELSE 0 END), 0) AS grams
      FROM "StockMovement"
      WHERE type IN ('DISPENSACION','DISPENSACION_REVERSA')
        AND ("occurredAt" AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
          = (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`,
    prisma.club.findUnique({ where: { id: "singleton" } }),
  ]);

  const stockTotal = Math.round(Number(stock[0]?.total ?? 0) * 100) / 100;
  const entregadoHoy = Math.round(Number(hoy[0]?.grams ?? 0) * 100) / 100;
  const saldos = lotes.map((b) => ({
    ...b,
    saldo: Math.round(
      b.movements.reduce(
        (a, m) => a + (["INGRESO", "AJUSTE_POSITIVO", "DISPENSACION_REVERSA"].includes(m.type) ? 1 : -1) * Number(m.grams),
        0,
      ) * 100,
    ) / 100,
  }));

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const kpis = [
    { href: "/socios?estado=ACTIVO", label: "Socios activos", value: activos, hint: `${total} en el padrón · ${plural(pendientes, "pendiente", "pendientes")} de alta`, tone: "ok" },
    { href: "/socios?filtro=reprocann", label: "REPROCANN a regularizar", value: conProblema.length, hint: conProblema.length ? (conProblema.length === 1 ? "no puede retirar hasta resolverlo" : "no pueden retirar hasta resolverlo") : "todos habilitados", tone: conProblema.length ? "danger" : "ok" },
    { href: "/stock", label: "Stock disponible", value: fmtGrams(stockTotal), hint: `${lotes.length} lotes en dispensario`, tone: "ok" },
    { href: "/dispensario", label: "Entregado hoy", value: fmtGrams(entregadoHoy), hint: `tope ${fmtGrams(club?.limiteDiarioG ?? 25)} por socio`, tone: "ok" },
  ];

  return (
    <>
      <PageHead
        title="Panel"
        subtitle="Todo lo que ves acá sale del libro de movimientos, no de un campo editable."
        actions={<Link className="btn" href="/dispensario">Entregar a un socio</Link>}
      />

      <div className="kpi-grid mb-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="kpi" data-tone={k.tone === "danger" ? "danger" : undefined}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value tnum">{k.value}</div>
            <div className="kpi-hint">{k.hint}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", alignItems: "start" }}>
        <Section
          title="Stock por lote"
          subtitle="El saldo es la suma del libro; se descuenta al entregar."
          action={<Link className="btn btn-secondary btn-sm" href="/stock">Ver lotes</Link>}
        >
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Cepa</th>
                  <th>Etapa</th>
                  <th className="num">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {saldos.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div className="cell-main">{b.code}</div>
                      <div className="cell-meta">{b.room ?? "sin sala"}</div>
                    </td>
                    <td>
                      <div>{b.strain.name}</div>
                      <div className="cell-meta">{b.thcPct ? `${Number(b.thcPct)}% THC` : "sin THC cargado"}</div>
                    </td>
                    <td><Chip tone={STAGE[b.stage]?.tone}>{STAGE[b.stage]?.label ?? b.stage}</Chip></td>
                    <td className="num cell-main">{fmtGrams(b.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {saldos.length === 0 ? <Empty>No hay lotes disponibles. Cargá la cosecha seca desde Stock.</Empty> : null}
          </div>
        </Section>

        <div className="flex flex-col gap-4">
          <Section title="Antes de entregar" subtitle="Socios activos con algo pendiente">
            <div className="px-4 pb-3 flex flex-col gap-2">
              {conProblema.map((m) => {
                const issue = reprocannIssue(m);
                return (
                  <Link key={m.id} href={`/socios/${m.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-[#f7f6f1]">
                    <div>
                      <div className="text-[13px]">{m.lastName}, {m.firstName}</div>
                      <div className="cell-meta">Legajo {m.legajo}</div>
                    </div>
                    <Chip tone={issue.tone}>{issue.label}</Chip>
                  </Link>
                );
              })}
              {conProblema.length === 0 ? <Empty>Nadie pendiente. Todos los socios activos están habilitados.</Empty> : null}
              <Link className="btn btn-secondary btn-sm mt-1 self-start" href="/socios?filtro=reprocann">
                Ver el padrón filtrado
              </Link>
            </div>
          </Section>

          <Section title="Últimas entregas" action={<Link className="btn btn-secondary btn-sm" href="/dispensario">Ver todo</Link>}>
            <div className="px-4 pb-3 flex flex-col gap-2">
              {ultimas.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <div>
                    <div>{d.member.lastName}, {d.member.firstName}</div>
                    <div className="cell-meta">{fmtDateTime(d.occurredAt)} · {d.batch.strain.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="tnum">{fmtGrams(d.grams)}</div>
                    {d.voidedAt ? <Chip tone="mute">anulada</Chip> : <Chip tone="ok">vigente</Chip>}
                  </div>
                </div>
              ))}
              {ultimas.length === 0 ? <Empty>Todavía no hay entregas registradas.</Empty> : null}
            </div>
          </Section>
        </div>
      </div>

      <div className="alert alert-warn mt-4">
        <strong>Datos del club pendientes.</strong> Falta cargar CUIT, director médico y responsable técnico. Los topes
        son configuración del club y no reemplazan la indicación médica ni el encuadre legal.
      </div>
    </>
  );
}
