"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { useToast } from "./toast";

type Row = { line: number; lastName: string; firstName: string; docNumber: string; birthDate: string; reprocannStatus: string; consumptionType: string };
type Preview = { preview: Row[]; skipped: { line: number; docNumber: string; legajo: number }[]; issues: { line: number; field: string; message: string }[] };

/** Importación del padrón en dos pasos: vista previa (no escribe) y confirmación. */
export function PadronImport() {
  const router = useRouter();
  const toast = useToast();
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [data, setData] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function preview(text: string) {
    setBusy(true);
    setError(null);
    try {
      setData(await api<Preview>("/api/members/import", { body: { csv: text } }));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head"><div>
        <h2 className="panel-title">Importar el padrón</h2>
        <p className="panel-sub">Subí la planilla que ya usa el club, guardada como CSV. Se reconocen columnas como Apellido, Nombre, DNI, Nacimiento, Teléfono, Email, REPROCANN, Vencimiento y Consumo. Los socios entran como pendientes: activarlos sigue siendo una decisión del club.</p>
      </div></div>
      <div className="panel-body stack" style={{ gap: 14 }}>
        <label className="btn btn-quiet" style={{ alignSelf: "flex-start" }}>
          <FileUp aria-hidden />{fileName || "Elegir archivo CSV"}
          <input
            aria-invalid={error || data?.issues.length ? true : undefined}
            aria-describedby={error ? "csv-error" : data?.issues.length ? "csv-filas" : undefined}
            disabled={busy}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              setFileName(file.name);
              setCsv(text);
              setData(null);
              void preview(text);
            }}
          />
        </label>
        {busy && !data ? <p className="muted" style={{ margin: 0 }}>Leyendo la planilla…</p> : null}
        {error ? <div className="note note-danger" id="csv-error" role="alert">{error}</div> : null}
        {data ? (
          <>
            <div className="flex flex-wrap gap-2">
              <span className="chip chip-ok">{data.preview.length} para importar</span>
              {data.skipped.length ? <span className="chip">{data.skipped.length} ya están en el padrón</span> : null}
              {data.issues.length ? <span className="chip chip-danger">{data.issues.length} problemas</span> : null}
            </div>
            {data.issues.length ? (
              <div className="note note-warn" id="csv-filas" role="alert">
                <div>
                  <b>Estas filas no se importan hasta corregirlas en la planilla:</b>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {data.issues.slice(0, 12).map((i, k) => <li key={k}>Fila {i.line}: {i.message}</li>)}
                    {data.issues.length > 12 ? <li>y {data.issues.length - 12} más.</li> : null}
                  </ul>
                </div>
              </div>
            ) : null}
            {data.preview.length ? (
              <div className="table-wrap" style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
                <table className="data">
                  <thead><tr><th>Fila</th><th>Socio</th><th>DNI</th><th>Nacimiento</th><th>REPROCANN</th></tr></thead>
                  <tbody>
                    {data.preview.map((r) => (
                      <tr key={r.line}><td className="cell-meta tnum">{r.line}</td><td className="cell-main">{r.lastName}, {r.firstName}</td><td className="tnum">{r.docNumber}</td><td className="tnum">{r.birthDate.split("-").reverse().join("/")}</td><td className="cell-meta">{r.reprocannStatus.toLowerCase().replace("_", " ")}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                className="btn"
                disabled={busy || data.preview.length === 0}
                onClick={async () => {
                  if (!csv) return;
                  setBusy(true);
                  try {
                    const r = await api<{ created: number }>("/api/members/import", { body: { csv, commit: true } });
                    toast({ tone: "ok", title: `${r.created} socios importados`, text: "Quedaron como pendientes de alta." });
                    setData(null);
                    setCsv(null);
                    setFileName("");
                    router.push("/socios?estado=PENDIENTE");
                  } catch (err) {
                    setError(errMsg(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Importar {data.preview.length} {data.preview.length === 1 ? "socio" : "socios"}
              </button>
              <button className="btn btn-ghost" onClick={() => { setData(null); setCsv(null); setFileName(""); }}>Descartar</button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
