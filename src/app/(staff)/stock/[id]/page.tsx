import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Minus, Plus, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { batchTotals, totalsOf } from "@/lib/stock";
import { nextStages, type Stage } from "@/lib/batch-rules";
import { Chip, Empty, Meter, Panel } from "@/components/ui";
import { HarvestButton, MovementButton, StageActions } from "@/components/stock-actions";
import { BatchActions } from "@/components/batch-actions";
import { fmtDate, fmtGrams, fmtWhen, MOVEMENT, ORIGIN, plural, STAGE } from "@/lib/labels";
import { MOVEMENT_SIGN } from "@/lib/limits";

export const metadata = { title: "Lote" };

export default async function LotePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      strain: true,
      movements: {
        orderBy: { occurredAt: "desc" },
        include: { actor: { select: { name: true } }, member: { select: { id: true, legajo: true, firstName: true, lastName: true } } },
      },
    },
  });
  if (!batch) notFound();
  const t = totalsOf(await batchTotals(prisma, [id]), id);
  const dry = Number(batch.dryWeightG ?? 0);

  // Recall: a quién fue cada gramo de este lote (neto de anulaciones).
  const recipients = new Map<string, { id: string; legajo: number; name: string; grams: number; count: number; last: Date }>();
  for (const m of batch.movements) {
    if (!m.member || (m.type !== "DISPENSACION" && m.type !== "DISPENSACION_REVERSA")) continue;
    const r = recipients.get(m.member.id) ?? { id: m.member.id, legajo: m.member.legajo, name: `${m.member.lastName}, ${m.member.firstName}`, grams: 0, count: 0, last: m.occurredAt };
    r.grams += (m.type === "DISPENSACION" ? 1 : -1) * Number(m.grams);
    if (m.type === "DISPENSACION") r.count += 1;
    if (m.occurredAt > r.last) r.last = m.occurredAt;
    recipients.set(m.member.id, r);
  }
  const recall = [...recipients.values()].filter((r) => r.grams > 0.001).sort((a, b) => b.grams - a.grams);
  const harvestable = ["FLORACION", "COSECHA", "CURADO"].includes(batch.stage) && !batch.dryWeightG;

  return (
    <>
      <Link className="crumb" href="/stock"><ArrowLeft aria-hidden /> Stock y lotes</Link>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">{batch.code}</h1>
          <p className="page-sub flex flex-wrap items-center gap-2" style={{ marginTop: 10 }}>
            <Chip tone={STAGE[batch.stage]?.tone}>{STAGE[batch.stage]?.label}</Chip>
            <span>{batch.strain.name}{batch.strain.genetics ? `, ${batch.strain.genetics.toLowerCase()}` : ""}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {harvestable ? <HarvestButton batch={{ id: batch.id, code: batch.code, stage: batch.stage, wetWeightG: batch.wetWeightG == null ? null : Number(batch.wetWeightG) }} /> : null}
          <StageActions id={batch.id} code={batch.code} next={nextStages(batch.stage as Stage)} balanceG={t.balanceG} isAdmin={session.role === "ADMIN"} />
          {session.role === "ADMIN" ? (
            <div className="mt-3" style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
              <div className="cell-meta mb-1">Cuarentena · bloquea la entrega y queda auditada</div>
              <BatchActions id={batch.id} stage={batch.stage} />
            </div>
          ) : null}
          {t.balanceG > 0 ? <MovementButton batchId={batch.id} label="Ajuste" /> : null}
        </div>
      </div>

      <div className="grid-2">
        <div className="stack">
          {batch.dryWeightG ? (
            <Panel title="Saldo del lote">
              <div className="panel-body">
                <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
                  <span className="big-g">{fmtGrams(t.balanceG).replace(" g", "")}<small>g</small></span>
                  <span className="cell-meta">de {fmtGrams(dry)} secos</span>
                </div>
                <Meter value={t.balanceG} max={dry || t.balanceG} tone={t.balanceG < Math.max(30, dry * 0.15) ? "warn" : "ok"} />
                <dl className="dl" style={{ marginTop: 16, gridTemplateColumns: "1fr auto" }}>
                  <dt>Ingresado</dt><dd className="num">{fmtGrams(t.ingresadoG)}</dd>
                  <dt>Entregado a socios</dt><dd className="num">{fmtGrams(t.entregadoG)}</dd>
                  <dt>Destruido</dt><dd className="num">{fmtGrams(t.destruidoG)}</dd>
                  {t.transferidoG ? <><dt>Transferido</dt><dd className="num">{fmtGrams(t.transferidoG)}</dd></> : null}
                  {t.ajustesG ? <><dt>Ajustes netos</dt><dd className="num">{t.ajustesG > 0 ? "+" : ""}{fmtGrams(t.ajustesG)}</dd></> : null}
                </dl>
              </div>
            </Panel>
          ) : null}

          <Panel title="A quién se entregó" subtitle="Para un retiro preventivo: cada socio que recibió de este lote, neto de anulaciones.">
            {recall.length === 0 ? (
              <Empty icon={Users}>Todavía no se entregó nada de este lote.</Empty>
            ) : (
              <ul className="rows">
                {recall.map((r) => (
                  <li key={r.id}>
                    <Link className="rowlink" href={`/socios/${r.id}`}>
                      <div className="grow"><div className="cell-main truncate">{r.name}</div><div className="cell-meta">Legajo {r.legajo} · {plural(r.count, "entrega", "entregas")} · última {fmtWhen(r.last)}</div></div>
                      <span className="tnum" style={{ fontWeight: 650 }}>{fmtGrams(Math.round(r.grams * 100) / 100)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Libro del lote" subtitle="Todos los asientos, del más reciente al primero.">
            {batch.movements.length === 0 ? (
              <Empty>Sin movimientos: el lote acredita stock cuando se registra el peso seco.</Empty>
            ) : (
              <ul className="timeline">
                {batch.movements.map((m) => {
                  const sign = MOVEMENT_SIGN[m.type] > 0 ? "+" : "-";
                  return (
                    <li key={m.id}>
                      <span className="tl-ico" data-sign={sign} data-kind={m.type}>{sign === "+" ? <Plus /> : <Minus />}</span>
                      <div style={{ minWidth: 0 }}>
                        <div>{MOVEMENT[m.type] ?? m.type}{m.member ? <> · <Link href={`/socios/${m.member.id}`}>Legajo {m.member.legajo}</Link></> : null}</div>
                        <div className="cell-meta">{fmtWhen(m.occurredAt)} · {m.actor.name}{m.reason && !m.member ? ` · ${m.reason}` : ""}</div>
                      </div>
                      <span className="tl-g">{sign === "+" ? "+" : "−"}{fmtGrams(m.grams)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Ficha de cultivo">
            <div className="panel-body">
              <dl className="dl">
                <dt>Origen</dt><dd>{ORIGIN[batch.originType]}{batch.originProviderName ? `, ${batch.originProviderName}` : ""}</dd>
                {batch.originProviderAddress ? <><dt>Procedencia</dt><dd>{batch.originProviderAddress}</dd></> : null}
                {batch.originReference ? <><dt>Referencia</dt><dd>{batch.originReference}</dd></> : null}
                <dt>Sala</dt><dd>{batch.room ?? "—"}</dd>
                <dt>Plantas</dt><dd>{batch.plantsCount ?? "—"}</dd>
                <dt>Siembra</dt><dd>{fmtDate(batch.plantedAt)}</dd>
                <dt>Corte</dt><dd>{fmtDate(batch.harvestedAt)}</dd>
                <dt>Peso húmedo</dt><dd>{batch.wetWeightG ? fmtGrams(batch.wetWeightG) : "—"}</dd>
                <dt>Peso seco</dt><dd>{batch.dryWeightG ? `${fmtGrams(batch.dryWeightG)}${batch.wetWeightG ? ` (${Math.round((dry / Number(batch.wetWeightG)) * 100)}% del húmedo)` : ""}` : "—"}</dd>
                <dt>THC</dt><dd>{batch.thcPct != null ? `${Number(batch.thcPct)}%` : "sin medir"}</dd>
                <dt>CBD</dt><dd>{batch.cbdPct != null ? `${Number(batch.cbdPct)}%` : "sin medir"}</dd>
              </dl>
              {batch.notes ? <p className="muted" style={{ margin: "14px 0 0", fontSize: 14, whiteSpace: "pre-line" }}>{batch.notes}</p> : null}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
