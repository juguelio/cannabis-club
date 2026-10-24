import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Chip, Empty, Meter, PageHead, Section } from "@/components/ui";
import { BatchForm, HarvestForm, MovementForm } from "@/components/forms";
import { fmtDate, fmtDateTime, fmtGrams, MOVEMENT, ORIGIN, STAGE } from "@/lib/labels";

const STAGE_ORDER = ["PROPAGACION", "VEGETATIVO", "FLORACION", "COSECHA", "CURADO", "DISPONIBLE"];

export default async function StockPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [strains, batches, movements] = await Promise.all([
    prisma.strain.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.batch.findMany({ include: { strain: true, movements: { select: { type: true, grams: true } } }, orderBy: { code: "desc" } }),
    prisma.stockMovement.findMany({
      take: 12,
      orderBy: { occurredAt: "desc" },
      include: { batch: { include: { strain: true } }, actor: true, member: true },
    }),
  ]);

  const rows = batches.map((b) => ({
    ...b,
    saldo:
      Math.round(
        b.movements.reduce(
          (a, m) => a + (["INGRESO", "AJUSTE_POSITIVO", "DISPENSACION_REVERSA"].includes(m.type) ? 1 : -1) * Number(m.grams),
          0,
        ) * 100,
      ) / 100,
  }));

  const pipeline = STAGE_ORDER.map((s) => ({ stage: s, count: rows.filter((r) => r.stage === s).length }));
  const sinSeco = rows
    .filter((r) => !r.dryWeightG)
    .map((r) => ({ id: r.id, code: r.code, wetWeightG: r.wetWeightG == null ? null : Number(r.wetWeightG) }));
  const allOptions = rows.map((r) => ({ id: r.id, code: `${r.code} · ${r.strain.name}` }));

  return (
    <>
      <PageHead
        title="Stock y trazabilidad"
        subtitle="El saldo es la suma del libro de movimientos. Un lote acredita stock recién con el peso seco."
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {pipeline.map((p) => (
          <span key={p.stage} className="chip">
            {STAGE[p.stage]?.label ?? p.stage}: <strong className="tnum ml-1">{p.count}</strong> {p.count === 1 ? "lote" : "lotes"}
          </span>
        ))}
      </div>

      <Section title="Lotes" subtitle="Saldo = ingresos − entregas − destrucciones − ajustes. El peso seco es lo cosechado.">
        <div className="overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Cepa</th>
                <th>Etapa</th>
                <th>Origen</th>
                <th className="num">Plantas</th>
                <th className="num">Húmedo</th>
                <th className="num">Seco</th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="cell-main">{b.code}</div>
                    <div className="cell-meta">{b.room ?? "sin sala"} · {fmtDate(b.harvestedAt)}</div>
                  </td>
                  <td>
                    <div>{b.strain.name}</div>
                    <div className="cell-meta">{b.thcPct ? `${Number(b.thcPct)}% THC` : "sin THC"}{b.cbdPct ? ` · ${Number(b.cbdPct)}% CBD` : ""}</div>
                  </td>
                  <td><Chip tone={STAGE[b.stage]?.tone}>{STAGE[b.stage]?.label ?? b.stage}</Chip></td>
                  <td className="cell-meta">
                    {ORIGIN[b.originType] ?? b.originType}
                    {b.originProviderName ? <div>{b.originProviderName}</div> : null}
                  </td>
                  <td className="num tnum">{b.plantsCount ?? "—"}</td>
                  <td className="num tnum">{b.wetWeightG ? fmtGrams(b.wetWeightG) : "—"}</td>
                  <td className="num tnum">{b.dryWeightG ? fmtGrams(b.dryWeightG) : "—"}</td>
                  <td className="num">
                    <div className="cell-main tnum">{fmtGrams(b.saldo)}</div>
                    {b.dryWeightG ? (
                      <>
                        <div className="cell-meta tnum">de {fmtGrams(b.dryWeightG)} secos</div>
                        <div style={{ width: 76, marginLeft: "auto" }}>
                          <Meter value={Math.max(0, b.saldo)} max={Number(b.dryWeightG)} />
                        </div>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <Empty>No hay lotes todavía. Cargá el primero abajo.</Empty> : null}
        </div>
      </Section>

      <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))" }}>
        <div className="card">
          <div className="px-4 pt-4 pb-2">
            <div className="section-title">Cosecha (dos pasos)</div>
            <p className="section-sub">Primero el peso húmedo; después el seco, que es el único que acredita stock.</p>
          </div>
          <div className="px-4 pb-4">
            <HarvestForm batches={sinSeco} />
          </div>
        </div>
        <div className="card">
          <div className="px-4 pt-4 pb-2">
            <div className="section-title">Nuevo lote</div>
            <p className="section-sub">Origen del material de propagación y etapa inicial.</p>
          </div>
          <div className="px-4 pb-4">
            <BatchForm strains={strains.map((s) => ({ id: s.id, name: s.name }))} />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Section title="Ajuste, destrucción o transferencia" subtitle="Todo movimiento queda firmado por quien lo registra">
          <div className="px-4 pb-4">
            <MovementForm batches={allOptions} />
          </div>
        </Section>
      </div>

      <div className="mt-4">
        <Section title="Últimos movimientos" subtitle="El libro: no se edita, se corrige con contra-asiento">
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Movimiento</th>
                  <th>Lote</th>
                  <th className="num">Gramos</th>
                  <th>Socio</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="cell-meta">{fmtDateTime(m.occurredAt)}</td>
                    <td>{MOVEMENT[m.type] ?? m.type}</td>
                    <td>
                      <div>{m.batch.code}</div>
                      <div className="cell-meta">{m.batch.strain.name}</div>
                    </td>
                    <td className="num tnum">{fmtGrams(m.grams)}</td>
                    <td className="cell-meta">{m.member ? `Legajo ${m.member.legajo}` : "—"}</td>
                    <td className="cell-meta">{m.actor.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {movements.length === 0 ? <Empty>Sin movimientos registrados.</Empty> : null}
          </div>
        </Section>
      </div>
    </>
  );
}
