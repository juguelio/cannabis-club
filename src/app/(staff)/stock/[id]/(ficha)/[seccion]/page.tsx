import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Minus, Plus, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { nextStages, type Stage } from "@/lib/batch-rules";
import { Chip, Empty, Panel } from "@/components/ui";
import { HarvestButton, MovementButton, StageActions } from "@/components/stock-actions";
import { BatchActions } from "@/components/batch-actions";
import { RecallForm, ReleaseForm } from "@/components/quality-actions";
import { fichaState } from "@/lib/batch-quality";
import { fmtDate, fmtGrams, fmtWhen, MOVEMENT, ORIGIN, plural } from "@/lib/labels";
import { MOVEMENT_SIGN } from "@/lib/limits";
import { ArchivoInput } from "@/components/archivo-legajo-input";
import { seccionesLote } from "@/lib/lote-secciones";
import { contextoLote } from "../contexto";

async function destinatarios(batchId: string) {
  const movimientos = await prisma.stockMovement.findMany({ where: { batchId, type: { in: ["DISPENSACION", "DISPENSACION_REVERSA"] } },
    select: { occurredAt: true, grams: true, type: true, member: { select: { id: true, legajo: true, firstName: true, lastName: true } } } });
  const recipients = new Map<string, { id: string; legajo: number; name: string; grams: number; count: number; last: Date }>();
  for (const m of movimientos) {
    if (!m.member || (m.type !== "DISPENSACION" && m.type !== "DISPENSACION_REVERSA")) continue;
    const r = recipients.get(m.member.id) ?? { id: m.member.id, legajo: m.member.legajo, name: `${m.member.lastName}, ${m.member.firstName}`, grams: 0, count: 0, last: m.occurredAt };
    r.grams += (m.type === "DISPENSACION" ? 1 : -1) * Number(m.grams);
    if (m.type === "DISPENSACION") r.count += 1;
    if (m.occurredAt > r.last) r.last = m.occurredAt;
    recipients.set(m.member.id, r);
  }
  return [...recipients.values()].filter((r) => r.grams > 0.001).sort((a, b) => b.grams - a.grams);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string; seccion: string }> }) {
  const { seccion } = await params;
  const title = Object.hasOwn(seccionesLote, seccion) ? seccionesLote[seccion as keyof typeof seccionesLote] : "Ficha";
  return { title: `${title} del lote` };
}

export default async function SeccionLote({ params, searchParams }: {
  params: Promise<{ id: string; seccion: string }>; searchParams: Promise<{ pagina?: string }>;
}) {
  const { id, seccion } = await params;
  const { batch, t, session } = await contextoLote(id);
  const admin = session.role === "ADMIN";
  if (seccion === "cultivo") {
    const dry = Number(batch.dryWeightG ?? 0);
    const harvestable = ["FLORACION", "COSECHA", "CURADO"].includes(batch.stage) && !batch.dryWeightG;
    return <div className="stack"><div className="flex flex-wrap gap-2">
          {harvestable ? <HarvestButton batch={{ id: batch.id, code: batch.code, stage: batch.stage, wetWeightG: batch.wetWeightG == null ? null : Number(batch.wetWeightG) }} /> : null}
          <StageActions id={batch.id} code={batch.code} next={nextStages(batch.stage as Stage)} balanceG={t.balanceG} isAdmin={session.role === "ADMIN"} />
    </div>
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
    </div>;
  }
  if (seccion === "calidad") {
    const recall = await destinatarios(id);
    const ficha = fichaState({ stage: batch.stage, thcPct: batch.thcPct == null ? null : Number(batch.thcPct), cbdPct: batch.cbdPct == null ? null : Number(batch.cbdPct), labResult: batch.labResult, recalledAt: batch.recalledAt });
    return <div className="stack">
          <Panel title="Calidad y liberación" subtitle="La firma registra quién habilitó el lote y cuándo. Administración puede liberar su propio ingreso.">
            <div className="panel-body stack" style={{ gap: 14 }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone={batch.releasedAt ? "ok" : "warn"}>{batch.releasedAt ? "Liberado" : "Sin liberar"}</Chip>
                      {ficha.recalled ? <Chip tone="danger">Retirado del mercado</Chip> : null}
                      {batch.releasedAt ? <span className="cell-meta">Firmado {fmtWhen(batch.releasedAt)}</span> : null}
                    </div>
                    <dl className="dl">
                      <dt>THC</dt><dd>{ficha.thcLabel}</dd>
                      <dt>CBD</dt><dd>{ficha.cbdLabel}</dd>
                      <dt>Análisis</dt><dd>{ficha.analysisLabel}</dd>
                      <dt>Laboratorio</dt><dd>{batch.labName ?? "—"}{batch.labDate ? ` · ${fmtDate(batch.labDate)}` : ""}</dd>
                      <dt>Muestra retenida</dt><dd>{batch.sampleRetainedG ? `${fmtGrams(batch.sampleRetainedG)}${batch.sampleUntil ? ` hasta ${fmtDate(batch.sampleUntil)}` : ""}` : "No registrada"}</dd>
                      {batch.recallReason ? <><dt>Motivo del retiro</dt><dd>{batch.recallReason}</dd></> : null}
                      {batch.releaseNote ? <><dt>Nota de liberación</dt><dd>{batch.releaseNote}</dd></> : null}
                    </dl>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link className="btn btn-sm btn-quiet" href={`/lote/${batch.code}`} target="_blank">Ficha pública</Link>
                    </div>
                    {!batch.releasedAt && !ficha.recalled ? <ReleaseForm id={batch.id} code={batch.code} isAdmin={session.role === "ADMIN"} /> : null}
                    {!ficha.recalled && session.role === "ADMIN" ? <RecallForm id={batch.id} code={batch.code} affected={recall.length} /> : null}
            </div>
          </Panel>

      {admin && <Panel title="Cuarentena"><div className="panel-body"><BatchActions id={id} stage={batch.stage} /></div></Panel>}
    </div>;
  }
  if (seccion === "destinatarios") {
    const recall = await destinatarios(id);
    return (<Panel title="A quién se entregó" subtitle="Para un retiro preventivo: cada socio que recibió de este lote, neto de anulaciones.">
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
          </Panel>);
  }
  if (seccion === "movimientos") {
    const n = Number((await searchParams).pagina);
    const pagina = Number.isSafeInteger(n) && n > 0 && n <= 1000000 ? n : 1;
    const registros = await prisma.stockMovement.findMany({ where: { batchId: id }, orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 21, skip: (pagina - 1) * 20, include: { actor: { select: { name: true } }, member: { select: { id: true, legajo: true } } } });
    return <div className="stack">
      {t.balanceG > 0 && <div><MovementButton batchId={id} label="Ajuste" /></div>}
          <Panel title="Libro del lote" subtitle="Todos los asientos, del más reciente al primero.">
            {registros.length === 0 ? (
              <Empty>Sin movimientos en esta página.</Empty>
            ) : (
              <ul className="timeline">
                {registros.slice(0, 20).map((m) => {
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
      <nav className="flex gap-2" aria-label="Páginas del libro">
        {pagina > 1 && <Link href={`?pagina=${pagina - 1}`}>Anterior</Link>}
        {registros.length > 20 && <Link href={`?pagina=${pagina + 1}`}>Siguiente</Link>}
      </nav>
    </div>;
  }
  if (seccion === "fotos") {
    const fotos = await prisma.batchPhoto.findMany({ where: { batchId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, updatedAt: true } });
    const base = `/api/batches/${id}/fotos`;
    return <Panel title="Fotos del lote"><div className="panel-body stack">
      {admin && <div><ArchivoInput id="nueva-foto" url={base} label="Agregar foto del lote" />
        <p className="cell-meta">JPG, PNG o WEBP de hasta 4 MB. Visibles para el personal del club.</p></div>}
      {!fotos.length && <p>Todavía no hay fotos de este lote.</p>}
      <div className="grid-2">{fotos.map((foto, i) => {
        const url = `${base}/${foto.id}`;
        const src = `${url}?v=${foto.updatedAt.getTime()}`;
        return <figure key={foto.id} className="stack">
          <a href={src} target="_blank" rel="noreferrer"><Image unoptimized width={480} height={320} loading="lazy"
            src={src} alt={`Foto ${i + 1} del lote ${batch.code}`} style={{ width: "100%", height: "auto", borderRadius: 8 }} /></a>
          <figcaption className="cell-meta">{fmtWhen(foto.updatedAt)}</figcaption>
          {admin && <ArchivoInput id={foto.id} url={url} label={`Reemplazar foto ${i + 1}`} />}
        </figure>;
      })}</div>
    </div></Panel>;
  }
  notFound();
}
