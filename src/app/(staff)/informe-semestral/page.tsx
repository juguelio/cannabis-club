import Link from "next/link";
import { Chip, Field, Note, PageHead, Panel } from "@/components/ui";
import { CircleAlert, FileSpreadsheet, Sprout } from "lucide-react";
import { listSemesterReports, semesterIntegrity, semesterPayload, signedSemesterReport } from "@/lib/semester-report";
import { isSemesterPeriod, semesterOf } from "@/lib/semester-rules";
import { SemesterSign } from "@/components/semester-sign";
import { fmtDateTime, fmtGrams } from "@/lib/labels";

export const dynamic = "force-dynamic";

/** Informe semestral (Res. 1780/2025): declaración jurada de plantas, variedades y actividad. */
export default async function SemesterPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const { periodo } = await searchParams;
  const period = periodo && isSemesterPeriod(periodo) ? periodo : semesterOf();

  const [payload, signed, reports] = await Promise.all([
    semesterPayload(period),
    signedSemesterReport(period),
    listSemesterReports(),
  ]);
  const integrity = signed ? semesterIntegrity(signed.payload, signed.hash) : null;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHead
        title="Informe semestral"
        subtitle="Declaración jurada de plantas totales y en floración, variedades y actividad del semestre (Res. 1780/2025)."
        actions={
          <div className="flex items-center gap-2">
            <a className="btn btn-quiet btn-sm" href={`/api/semester/${period}`}>CSV</a>
            <Link className="btn btn-quiet btn-sm" href={`/informe-semestral/${period}/imprimir`}>Imprimir</Link>
            <SemesterSign period={period} signed={Boolean(signed)} />
          </div>
        }
      />

      {payload.cultivation.plantsTotal === 0 ? (
        <Note tone="warn" icon={CircleAlert}>
          <b>No hay plantas en cultivo cargadas.</b> El informe declara 0 porque ningún lote está en propagación, vegetativo o
          floración. Si hay plantas, cargá <b>cantidad de plantas</b> y <b>sala</b> en cada lote: sin ese dato el informe no sirve
          para presentar.
        </Note>
      ) : null}

      <Panel title={`Período ${period}`} subtitle={`${payload.from} → ${payload.to}`}>
        <div className="flex flex-wrap items-center gap-3">
          {signed ? (
            <>
              <Chip tone="ok">Firmado</Chip>
              <span className="cell-meta">{fmtDateTime(signed.signedAt)} · {signed.signer.name} · huella {signed.hash.slice(0, 12)}…</span>
              <Chip tone={integrity ? "ok" : "danger"}>{integrity ? "Integridad: coincide" : "El contenido no coincide con lo firmado"}</Chip>
            </>
          ) : (
            <>
              <Chip tone="warn">Sin firmar</Chip>
              <span className="cell-meta">Es una vista previa: los números se recalculan de los libros hasta que se firma.</span>
            </>
          )}
        </div>
      </Panel>

      <div className="grid-2">
        <Panel title="Plantas al cierre">
          <div className="stack" style={{ gap: 10 }}>
            <Field label="Plantas totales" value={<b className="tnum" style={{ fontSize: 22 }}>{payload.cultivation.plantsTotal}</b>} />
            <Field label="En floración" value={<b className="tnum" style={{ fontSize: 22 }}>{payload.cultivation.plantsFlowering}</b>} />
            <Field label="Propagación" value={payload.cultivation.byStage.PROPAGACION ?? 0} />
            <Field label="Vegetativo" value={payload.cultivation.byStage.VEGETATIVO ?? 0} />
          </div>
        </Panel>
        <Panel title="Actividad del semestre">
          <div className="stack" style={{ gap: 10 }}>
            <Field label="Cosechado" value={fmtGrams(payload.activity.harvestedGrams)} />
            <Field label="Dispensado" value={fmtGrams(payload.activity.dispensedGrams)} />
            <Field label="Entregas registradas" value={payload.activity.dispensations} />
            <Field label="Lotes retirados" value={payload.activity.recalledBatches} />
          </div>
        </Panel>
      </div>

      <Panel title="Variedades" subtitle="Genética registrada y cuántas plantas aporta cada una">
        {payload.varieties.length === 0 ? (
          <p className="cell-meta" style={{ margin: 0 }}>No hay variedades cargadas.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Variedad</th>
                <th>Genética</th>
                <th className="num">Plantas</th>
                <th className="num">En floración</th>
                <th className="num">Lotes en cultivo</th>
                <th>Registro</th>
              </tr>
            </thead>
            <tbody>
              {payload.varieties.map((v) => (
                <tr key={v.name}>
                  <td>{v.name}</td>
                  <td>{v.genetics ?? "—"}</td>
                  <td className="num tnum">{v.plantsTotal}</td>
                  <td className="num tnum">{v.plantsFlowering}</td>
                  <td className="num tnum">{v.batches}</td>
                  <td>{v.registered ? <Chip tone="ok">Activa</Chip> : <Chip tone="mute">Inactiva</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Salas" subtitle="Dónde están las plantas declaradas">
        {payload.cultivation.rooms.length === 0 ? (
          <p className="cell-meta" style={{ margin: 0 }}>Sin salas cargadas en los lotes.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Sala</th>
                <th className="num">Plantas</th>
                <th className="num">En floración</th>
              </tr>
            </thead>
            <tbody>
              {payload.cultivation.rooms.map((r) => (
                <tr key={r.room}>
                  <td>{r.room}</td>
                  <td className="num tnum">{r.plants}</td>
                  <td className="num tnum">{r.flowering}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Lotes en cultivo" subtitle={`${payload.cultivation.batches.length} lotes`} action={<Sprout size={16} aria-hidden />}>
        <table className="table">
          <thead>
            <tr>
              <th>Lote</th>
              <th>Variedad</th>
              <th>Sala</th>
              <th>Etapa</th>
              <th className="num">Plantas</th>
              <th>Plantado</th>
            </tr>
          </thead>
          <tbody>
            {payload.cultivation.batches.map((b) => (
              <tr key={b.code}>
                <td className="tnum">{b.code}</td>
                <td>{b.strain}</td>
                <td>{b.room ?? "—"}</td>
                <td>{b.stage}</td>
                <td className="num tnum">{b.plants}</td>
                <td>{b.plantedAt ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Note tone="warn" icon={CircleAlert}>
        <div className="stack" style={{ gap: 4 }}>
          <b>Lo que este informe no declara (y no se inventa):</b>
          {payload.gaps.map((g) => (
            <div key={g}>{g}</div>
          ))}
        </div>
      </Note>

      <Panel title="Informes firmados" subtitle="El informe firmado no se edita: se corrige con uno nuevo">
        {reports.length === 0 ? (
          <p className="cell-meta" style={{ margin: 0 }}>Todavía no hay informes firmados.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Período</th>
                <th>Firmado</th>
                <th>Por</th>
                <th>Huella</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td><Link className="link-strong" href={`/informe-semestral?periodo=${r.period}`}>{r.period}</Link></td>
                  <td>{fmtDateTime(r.signedAt)}</td>
                  <td>{r.signer.name}</td>
                  <td className="tnum cell-meta">{r.hash.slice(0, 12)}…</td>
                  <td className="num">
                    <a className="btn btn-sm btn-quiet" href={`/informe-semestral/${r.period}/imprimir`}><FileSpreadsheet size={14} aria-hidden /> Ver</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
