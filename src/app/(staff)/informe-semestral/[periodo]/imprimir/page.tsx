import Link from "next/link";
import { notFound } from "next/navigation";
import { semesterPayload, semesterIntegrity, signedSemesterReport } from "@/lib/semester-report";
import { isSemesterPeriod } from "@/lib/semester-rules";
import { PrintButton } from "@/components/print-button";
import { fmtDateTime } from "@/lib/labels";

export const dynamic = "force-dynamic";

/**
 * Informe imprimible para firmar a mano: lo que ve un inspector.
 * Si el período está firmado, imprime el contenido firmado (no el recálculo de hoy).
 */
export default async function SemesterPrintPage({ params }: { params: Promise<{ periodo: string }> }) {
  const { periodo } = await params;
  if (!isSemesterPeriod(periodo)) notFound();
  const signed = await signedSemesterReport(periodo);
  const payload = signed ? (signed.payload as Awaited<ReturnType<typeof semesterPayload>>) : await semesterPayload(periodo);
  const integrity = signed ? semesterIntegrity(signed.payload, signed.hash) : null;

  return (
    <div className="stack" style={{ gap: 14, maxWidth: 780 }}>
      <div className="no-print flex items-center justify-between gap-2">
        <Link className="crumb" href={`/informe-semestral?periodo=${periodo}`}>← Volver</Link>
        <PrintButton />
      </div>

      <div className="card card-pad" style={{ border: "1px solid var(--line)" }}>
        <div className="cell-meta" style={{ textTransform: "uppercase", letterSpacing: ".12em" }}>Declaración jurada · Res. 1780/2025</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "-.02em", margin: "4px 0 2px" }}>
          Informe semestral {payload.period}
        </h1>
        <div className="cell-meta">{payload.from} → {payload.to}</div>

        <div className="grid-2" style={{ marginTop: 16 }}>
          <div><div className="label">Asociación</div><div>{payload.club.nombre}</div></div>
          <div><div className="label">CUIT</div><div>{payload.club.cuit ?? "—"}</div></div>
          <div><div className="label">REPROCANN</div><div>{payload.club.reprocannNumber ?? "—"}</div></div>
          <div><div className="label">Responsable Técnico</div><div>{payload.club.responsableTecnico ?? "—"}</div></div>
          <div><div className="label">Director Médico</div><div>{payload.club.directorMedico ?? "—"}</div></div>
          <div><div className="label">Estado</div><div>{signed ? `Firmado ${fmtDateTime(signed.signedAt)} · ${signed.signer.name}` : "Vista previa sin firmar"}</div></div>
        </div>

        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, marginTop: 22 }}>Plantas</h2>
        <table className="table">
          <tbody>
            <tr><td>Plantas totales</td><td className="num tnum"><b>{payload.cultivation.plantsTotal}</b></td></tr>
            <tr><td>Plantas en floración</td><td className="num tnum"><b>{payload.cultivation.plantsFlowering}</b></td></tr>
            <tr><td>Propagación</td><td className="num tnum">{payload.cultivation.byStage.PROPAGACION ?? 0}</td></tr>
            <tr><td>Vegetativo</td><td className="num tnum">{payload.cultivation.byStage.VEGETATIVO ?? 0}</td></tr>
          </tbody>
        </table>

        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, marginTop: 22 }}>Variedades</h2>
        <table className="table">
          <thead>
            <tr><th>Variedad</th><th>Genética</th><th className="num">Plantas</th><th className="num">En floración</th></tr>
          </thead>
          <tbody>
            {payload.varieties.map((v) => (
              <tr key={v.name}>
                <td>{v.name}</td>
                <td>{v.genetics ?? "—"}</td>
                <td className="num tnum">{v.plantsTotal}</td>
                <td className="num tnum">{v.plantsFlowering}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, marginTop: 22 }}>Lotes en cultivo</h2>
        <table className="table">
          <thead>
            <tr><th>Lote</th><th>Variedad</th><th>Sala</th><th>Etapa</th><th className="num">Plantas</th><th>Plantado</th></tr>
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

        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, marginTop: 22 }}>Actividad del semestre</h2>
        <table className="table">
          <tbody>
            <tr><td>Cosechado</td><td className="num tnum">{payload.activity.harvestedGrams} g</td></tr>
            <tr><td>Dispensado</td><td className="num tnum">{payload.activity.dispensedGrams} g</td></tr>
            <tr><td>Entregas registradas</td><td className="num tnum">{payload.activity.dispensations}</td></tr>
            <tr><td>Lotes retirados</td><td className="num tnum">{payload.activity.recalledBatches}</td></tr>
          </tbody>
        </table>

        <div className="cell-meta" style={{ marginTop: 16, lineHeight: 1.5 }}>
          {payload.gaps.map((g) => (
            <div key={g}>· {g}</div>
          ))}
        </div>

        {signed ? (
          <div className="cell-meta" style={{ marginTop: 14 }}>
            Huella SHA-256 del contenido firmado: <span className="tnum">{signed.hash}</span>
            {integrity === false ? <b> · el contenido guardado no coincide con la huella</b> : null}
          </div>
        ) : null}

        <div className="flex justify-between" style={{ marginTop: 40, gap: 24 }}>
          <div style={{ flex: 1, borderTop: "1px solid var(--line)", paddingTop: 6, fontSize: 12 }}>Responsable Técnico</div>
          <div style={{ flex: 1, borderTop: "1px solid var(--line)", paddingTop: 6, fontSize: 12 }}>Presidente / autoridad de la asociación</div>
        </div>
      </div>
    </div>
  );
}
