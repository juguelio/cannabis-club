import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Chip, Empty, Field, PageHead, Section } from "@/components/ui";
import { BatchActions } from "@/components/batch-actions";
import { batchDetail } from "@/lib/batch-ops";
import { fmtDate, fmtDateTime, fmtGrams, MOVEMENT, ORIGIN, STAGE } from "@/lib/labels";

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const data = await batchDetail(id);
  if (!data) notFound();
  const { batch, saldo, afectados } = data;
  const etapa = STAGE[batch.stage] ?? { label: batch.stage, tone: "mute" as const };
  const entregado = Math.round(afectados.reduce((a, x) => a + x.grams, 0) * 100) / 100;

  return (
    <>
      <PageHead
        title={`Lote ${batch.code}`}
        subtitle={`${batch.strain.name} · ${etapa.label} · ${fmtGrams(saldo)} en stock`}
        actions={<Link className="btn btn-secondary" href="/stock">Volver al stock</Link>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Ficha" subtitle="Origen y trazabilidad del lote">
          <div className="grid gap-2">
            <Field label="Cepa" value={batch.strain.name} />
            <Field label="Etapa" value={<Chip tone={etapa.tone}>{etapa.label}</Chip>} />
            <Field label="Origen" value={ORIGIN[batch.originType] ?? batch.originType} />
            <Field label="Proveedor" value={batch.originProviderName ?? "—"} />
            <Field label="Sala" value={batch.room ?? "—"} />
            <Field label="Plantas" value={batch.plantsCount ?? "—"} />
            <Field label="Plantado" value={fmtDate(batch.plantedAt)} />
            <Field label="Cosechado" value={fmtDate(batch.harvestedAt)} />
            <Field label="Peso húmedo" value={batch.wetWeightG == null ? "—" : fmtGrams(batch.wetWeightG)} />
            <Field label="Peso seco" value={batch.dryWeightG == null ? "—" : fmtGrams(batch.dryWeightG)} />
            <Field label="THC / CBD" value={`${batch.thcPct ?? "—"} / ${batch.cbdPct ?? "—"}`} />
            <Field label="Stock del libro" value={fmtGrams(saldo)} />
            <Field label="Entregado del lote" value={fmtGrams(entregado)} />
          </div>
        </Section>

        <Section title="Cuarentena y destino" subtitle="Un lote en cuarentena no se puede entregar: el mostrador lo rechaza">
          <BatchActions id={batch.id} stage={batch.stage} />
          <p className="cell-meta mt-3">
            Poner en cuarentena no borra nada: cambia la etapa, deja el motivo en la nota del lote y registra
            <code> BATCH_QUARANTINE </code> en la auditoría.
          </p>
        </Section>

        <Section title="A quién le tocó" subtitle="Socios con entregas vigentes de este lote">
          {afectados.length === 0 ? (
            <Empty>Sin entregas registradas.</Empty>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Legajo</th>
                  <th>Socio</th>
                  <th>Entregas</th>
                  <th>Gramos</th>
                </tr>
              </thead>
              <tbody>
                {afectados.map((a) => (
                  <tr key={a.legajo}>
                    <td className="tnum">{a.legajo}</td>
                    <td>{a.name}</td>
                    <td className="tnum">{a.entregas}</td>
                    <td className="tnum">{fmtGrams(a.grams)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <Section title="Libro del lote" subtitle="Cada asiento con signo: el saldo es la suma, no un campo editable">
        <div className="overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Gramos</th>
                <th>Socio</th>
                <th>Motivo</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {batch.movements.map((m) => (
                <tr key={m.id}>
                  <td className="cell-meta">{fmtDateTime(m.occurredAt)}</td>
                  <td>{MOVEMENT[m.type] ?? m.type}</td>
                  <td className="tnum">{fmtGrams(m.grams)}</td>
                  <td>{m.member ? `${m.member.legajo} · ${m.member.lastName}` : "—"}</td>
                  <td className="cell-meta">{m.reason ?? "—"}</td>
                  <td className="cell-meta">{m.actor?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Entregas" subtitle="Las anuladas quedan visibles: el libro no borra, corrige">
        {batch.dispensations.length === 0 ? (
          <Empty>Sin entregas de este lote.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Socio</th>
                  <th>Gramos</th>
                  <th>THC</th>
                  <th>Operador</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {batch.dispensations.map((d) => (
                  <tr key={d.id}>
                    <td className="cell-meta">{fmtDateTime(d.occurredAt)}</td>
                    <td>
                      <Link href={`/socios/${d.memberId}`}>{d.member.legajo} · {d.member.lastName}, {d.member.firstName}</Link>
                    </td>
                    <td className="tnum">{fmtGrams(d.grams)}</td>
                    <td className="tnum">{d.thcPct == null ? "—" : String(d.thcPct)}</td>
                    <td className="cell-meta">{d.operator?.name ?? "—"}</td>
                    <td>{d.voidedAt ? <Chip tone="warn">Anulada</Chip> : <Chip tone="ok">Vigente</Chip>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
