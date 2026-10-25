import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getClub } from "@/lib/club";
import { Chip, PageHead, Panel } from "@/components/ui";
import { fmtDate, fmtGrams, fmtWhen } from "@/lib/labels";
import { listCloses } from "@/lib/monthly-close";
import { balanceFromMovements } from "@/lib/limits";

export const dynamic = "force-dynamic";

/** Modo inspección: todo lo que un inspector pide ver, en una pantalla y sin nada editable. */
export default async function InspectionPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [club, members, batches, movements, closes, lasts, audit] = await Promise.all([
    getClub(),
    prisma.member.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.batch.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, stage: true, strain: { select: { name: true } }, dryWeightG: true, thcPct: true, releasedAt: true, recalledAt: true, labResult: true, harvestedAt: true },
    }),
    prisma.stockMovement.findMany({ select: { type: true, grams: true } }),
    listCloses(6),
    prisma.dispensation.findMany({ orderBy: { occurredAt: "desc" }, take: 8, select: { occurredAt: true, grams: true, voidedAt: true, member: { select: { legajo: true } }, batch: { select: { code: true } } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true } } } }),
  ]);

  const stock = balanceFromMovements(movements);
  const socios: Record<string, number> = {};
  for (const m of members) socios[m.status] = m._count._all;
  const sinLiberar = batches.filter((b) => !b.releasedAt && !b.recalledAt);
  const retirados = batches.filter((b) => b.recalledAt);

  return (
    <>
      <PageHead
        title="Modo inspección"
        subtitle="Lectura únicamente: identidad, topes, padrón, lotes y cierres. Nada de esta pantalla se puede editar."
        actions={<Link className="btn btn-sm btn-quiet" href="/cierre-mensual">Cierre mensual</Link>}
      />

      <div className="grid-2">
        <div className="stack">
          <Panel title="Identidad del club">
            <div className="panel-body">
              <dl className="dl">
                <dt>Nombre</dt><dd>{club.nombre}</dd>
                <dt>CUIT</dt><dd>{club.cuit || "Sin cargar"}</dd>
                <dt>Director médico</dt><dd>{club.directorMedico || "Sin cargar"}</dd>
                <dt>Responsable técnico</dt><dd>{club.responsableTecnico || "Sin cargar"}</dd>
                <dt>REPROCANN del club</dt><dd>{club.reprocannNumber || "Sin cargar"}</dd>
                <dt>Liberación firmada</dt><dd>{club.requiereLiberacion ? "Exigida" : "No exigida"}</dd>
              </dl>
            </div>
          </Panel>

          <Panel title="Topes vigentes">
            <div className="panel-body">
              <dl className="dl">
                <dt>Tope diario</dt><dd>{fmtGrams(club.limiteDiarioG)}</dd>
                <dt>Tope mensual</dt><dd>{fmtGrams(club.limiteMensualG)}</dd>
                <dt>Tope reducido por edad</dt><dd>{fmtGrams(club.limiteMenorG)}{club.thcMaxMenor ? ` · hasta ${Number(club.thcMaxMenor)} % THC` : ""}</dd>
                <dt>Cupo de socios</dt><dd>{club.maxSocios}</dd>
              </dl>
            </div>
          </Panel>

          <Panel title="Padrón y stock">
            <div className="panel-body">
              <dl className="dl">
                <dt>Socios activos</dt><dd>{socios.ACTIVO ?? 0}</dd>
                <dt>Pendientes</dt><dd>{socios.PENDIENTE ?? 0}</dd>
                <dt>Suspendidos</dt><dd>{socios.SUSPENDIDO ?? 0}</dd>
                <dt>De baja</dt><dd>{socios.BAJA ?? 0}</dd>
                <dt>Stock total</dt><dd>{fmtGrams(stock)}</dd>
                <dt>Lotes retirados</dt><dd>{retirados.length}</dd>
                <dt>Lotes sin liberar</dt><dd>{sinLiberar.length}</dd>
              </dl>
            </div>
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Lotes" subtitle="Etapa, análisis y liberación de cada lote.">
            <div className="panel-body">
              <table className="table">
                <thead><tr><th>Lote</th><th>Etapa</th><th>THC</th><th>Liberado</th></tr></thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td>{b.code}<div className="cell-meta">{b.strain.name}</div></td>
                      <td><Chip tone={b.recalledAt ? "danger" : b.releasedAt ? "ok" : "warn"}>{b.recalledAt ? "Retirado" : b.stage}</Chip></td>
                      <td className="tnum">{b.thcPct == null ? "pendiente" : `${Number(b.thcPct)} %`}</td>
                      <td className="cell-meta">{b.releasedAt ? fmtDate(b.releasedAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Últimas entregas" subtitle="Con su estado: una anulada no cuenta para los topes.">
            <div className="panel-body">
              <table className="table">
                <tbody>
                  {lasts.map((d, i) => (
                    <tr key={i}>
                      <td className="cell-meta">{fmtWhen(d.occurredAt)}</td>
                      <td>Legajo {d.member.legajo} · {d.batch.code}</td>
                      <td className="num tnum">{fmtGrams(d.grams)}</td>
                      <td className="cell-meta">{d.voidedAt ? "anulada" : "vigente"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Cierres firmados">
            <div className="panel-body">
              {closes.length === 0 ? <p className="muted" style={{ margin: 0 }}>Sin cierres firmados.</p> : (
                <table className="table">
                  <tbody>
                    {closes.map((c) => (
                      <tr key={c.id}>
                        <td>{c.period}</td>
                        <td className="cell-meta">{c.signer.name} · {fmtWhen(c.signedAt)}</td>
                        <td className="cell-meta tnum">{c.hash.slice(0, 10)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Actividad reciente" subtitle="Quién hizo qué, con fecha y hora.">
        <div className="panel-body">
          <table className="table">
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="cell-meta">{fmtWhen(a.createdAt)}</td>
                  <td className="cell-meta">{a.actor?.name ?? "—"}</td>
                  <td>{a.action}</td>
                  <td className="cell-meta">{a.entity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
