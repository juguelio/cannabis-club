import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Sprout } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { batchesWithTotals } from "@/lib/stock";
import { Chip, Empty, Meter, PageHead, Panel } from "@/components/ui";
import { MovementButton, NewBatchButton } from "@/components/stock-actions";
import { fmtGrams, fmtWhen, MOVEMENT, ORIGIN, plural, STAGE } from "@/lib/labels";
import { MOVEMENT_SIGN } from "@/lib/limits";

export const metadata = { title: "Stock y lotes" };
const PIPE = ["PROPAGACION", "VEGETATIVO", "FLORACION", "COSECHA", "CURADO", "DISPONIBLE"];

const NEXT_STEP: Record<string, string> = {
  PROPAGACION: "Siguiente: pasar a vegetativo",
  VEGETATIVO: "Siguiente: pasar a floración",
  FLORACION: "Siguiente: registrar la cosecha",
  COSECHA: "Siguiente: secado y curado",
  CURADO: "Siguiente: registrar el peso seco",
};

export default async function StockPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [strains, batches, movements] = await Promise.all([
    prisma.strain.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    batchesWithTotals(),
    prisma.stockMovement.findMany({
      take: 10,
      orderBy: { occurredAt: "desc" },
      include: { batch: { include: { strain: true } }, actor: { select: { name: true } }, member: { select: { id: true, legajo: true, lastName: true } } },
    }),
  ]);

  const open = batches.filter((b) => PIPE.includes(b.stage)).sort((a, b) => PIPE.indexOf(b.stage) - PIPE.indexOf(a.stage) || b.code.localeCompare(a.code));
  const closed = batches.filter((b) => !PIPE.includes(b.stage));
  const available = open.filter((b) => b.stage === "DISPONIBLE");
  const stockG = available.reduce((a, b) => a + b.totals.balanceG, 0);
  const withStock = batches.filter((b) => b.totals.balanceG > 0).map((b) => ({ id: b.id, code: b.code }));

  return (
    <>
      <PageHead
        title="Stock y lotes"
        subtitle={`${fmtGrams(Math.round(stockG * 100) / 100)} para entregar en ${plural(available.length, "lote", "lotes")}. El saldo es la suma del libro de movimientos; un lote acredita stock recién con su peso seco.`}
        actions={
          <>
            {withStock.length ? <MovementButton batches={withStock} /> : null}
            <NewBatchButton strains={strains.map((s) => ({ id: s.id, name: s.name }))} />
          </>
        }
      />

      <div className="pipeline" style={{ marginBottom: 16 }} aria-label="Lotes por etapa">
        {PIPE.map((s) => {
          const here = open.filter((b) => b.stage === s);
          return (
            <div key={s} className="stage" data-live={s === "DISPONIBLE" && here.length > 0}>
              <div className="stage-name">{STAGE[s].label}</div>
              <div className="stage-n">{here.length}</div>
              <div className="stage-codes">{here.length ? here.map((b) => b.code).join(", ") : "—"}</div>
            </div>
          );
        })}
      </div>

      {open.length === 0 ? (
        <Panel><Empty icon={Sprout} title="No hay lotes en curso">Creá el primero con su origen y etapa.</Empty></Panel>
      ) : (
        <div className="grid-auto">
          {open.map((b) => {
            const dry = Number(b.dryWeightG ?? 0);
            return (
              <Link key={b.id} href={`/stock/${b.id}`} className="panel lot-card">
                <div className="flex items-start justify-between gap-3">
                  <div style={{ minWidth: 0 }}>
                    <h2 className="panel-title">{b.code}</h2>
                    <div className="cell-meta">{b.strain.name}{b.thcPct != null ? ` · ${Number(b.thcPct)}% THC` : ""}{b.cbdPct != null ? ` · ${Number(b.cbdPct)}% CBD` : ""}</div>
                  </div>
                  <Chip tone={STAGE[b.stage]?.tone}>{STAGE[b.stage]?.label}</Chip>
                </div>
                {b.stage === "DISPONIBLE" ? (
                  <div>
                    <div className="flex items-baseline justify-between" style={{ marginBottom: 7 }}>
                      <span className="big-g">{fmtGrams(b.totals.balanceG).replace(" g", "")}<small>g</small></span>
                      <span className="cell-meta">de {fmtGrams(dry)} secos</span>
                    </div>
                    <Meter value={b.totals.balanceG} max={dry || b.totals.balanceG} tone={b.totals.balanceG < Math.max(30, dry * 0.15) ? "warn" : "ok"} />
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 14 }}>{NEXT_STEP[b.stage]}</div>
                )}
                <div className="cell-meta">
                  {[b.room ?? "Sin sala", b.plantsCount != null ? plural(b.plantsCount, "planta", "plantas") : null, ORIGIN[b.originType]].filter(Boolean).join(" · ")}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="grid-2" style={{ marginTop: 16 }}>
        <Panel title="Libro de movimientos" subtitle="Los últimos 10 asientos. No se editan: se corrigen con un movimiento opuesto.">
          {movements.length === 0 ? (
            <Empty icon={BookOpen}>Sin movimientos registrados.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Cuándo</th><th>Movimiento</th><th>Lote</th><th className="num">Gramos</th><th className="hide-sm">Registró</th></tr></thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="cell-meta" style={{ whiteSpace: "nowrap" }}>{fmtWhen(m.occurredAt)}</td>
                      <td>
                        <div>{MOVEMENT[m.type] ?? m.type}</div>
                        <div className="cell-meta truncate" style={{ maxWidth: 260 }}>{m.member ? `Legajo ${m.member.legajo}, ${m.member.lastName}` : m.reason}</div>
                      </td>
                      <td><Link className="row-link" href={`/stock/${m.batchId}`}><span className="cell-main nowrap">{m.batch.code}</span></Link></td>
                      <td className="num tnum" style={{ fontWeight: 600, color: MOVEMENT_SIGN[m.type] > 0 ? "var(--ok)" : undefined }}>
                        {MOVEMENT_SIGN[m.type] > 0 ? "+" : "−"}{fmtGrams(m.grams)}
                      </td>
                      <td className="cell-meta hide-sm">{m.actor.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Lotes cerrados" subtitle="Agotados y destruidos: siguen en el libro para la trazabilidad.">
          {closed.length === 0 ? (
            <Empty>Todavía no se cerró ningún lote.</Empty>
          ) : (
            <ul className="rows">
              {closed.map((b) => (
                <li key={b.id}>
                  <Link className="rowlink" href={`/stock/${b.id}`}>
                    <div className="grow"><div className="cell-main">{b.code}</div><div className="cell-meta">{b.strain.name} · entregado {fmtGrams(b.totals.entregadoG)}</div></div>
                    <Chip tone={STAGE[b.stage]?.tone}>{STAGE[b.stage]?.label}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
