"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";
import { useToast } from "@/components/toast";

type Check = { moho: boolean; extrana: boolean; humedad: boolean; olor: boolean };
const ITEMS: { key: keyof Check; label: string }[] = [
  { key: "moho", label: "Sin moho ni oídio a la vista" },
  { key: "extrana", label: "Sin materia extraña (tierra, pelos, plástico)" },
  { key: "humedad", label: "Humedad al tacto correcta (no se apelmaza)" },
  { key: "olor", label: "Olor normal, sin olor a humedad" },
];

/** Liberación con firma de calidad: habilita las entregas del lote (REA 5.1 + 5.3). */
export function ReleaseForm({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<Check>({ moho: false, extrana: false, humedad: false, olor: false });
  const [thc, setThc] = useState("");
  const [cbd, setCbd] = useState("");
  const [labName, setLabName] = useState("");
  const [labResult, setLabResult] = useState("");
  const [labDate, setLabDate] = useState("");
  const [sampleG, setSampleG] = useState("");
  const [sampleUntil, setSampleUntil] = useState("");
  const [noAnalysis, setNoAnalysis] = useState(false);

  const allChecked = ITEMS.every((i) => check[i.key]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
    if (!allChecked) {
      setError("Marcá los cuatro controles: la liberación se firma con la revisión hecha.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/batches/${id}/release`, {
        body: {
          checklist: check,
          thcPct: num(thc),
          cbdPct: num(cbd),
          labName: labName.trim() || undefined,
          labDate: labDate || undefined,
          labResult: labResult.trim() || undefined,
          sampleRetainedG: num(sampleG) ?? undefined,
          sampleUntil: sampleUntil || undefined,
          noAnalysisAcknowledged: noAnalysis || undefined,
        },
      });
      toast({ tone: "ok", title: "Lote liberado", text: `${code} ya puede entregarse. Quedó firmado quién lo liberó.` });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div>
        <p style={{ margin: "0 0 10px" }} className="cell-meta">
          Sin liberación firmada, el dispensario rechaza cualquier entrega de este lote.
        </p>
        <button className="btn" onClick={() => setOpen(true)}>Liberar lote</button>
      </div>
    );
  }

  return (
    <form className="stack" style={{ gap: 12 }} onSubmit={submit}>
      <div className="stack" style={{ gap: 6 }}>
        {ITEMS.map((item) => (
          <label key={item.key} className="check">
            <input
              type="checkbox"
              checked={check[item.key]}
              onChange={(e) => setCheck((c) => ({ ...c, [item.key]: e.target.checked }))}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
      <div className="field-row">
        <div><label className="label" htmlFor="r-thc">THC (%)</label><input id="r-thc" className="input tnum" inputMode="decimal" value={thc} onChange={(e) => setThc(e.target.value)} placeholder="pendiente" /></div>
        <div><label className="label" htmlFor="r-cbd">CBD (%)</label><input id="r-cbd" className="input tnum" inputMode="decimal" value={cbd} onChange={(e) => setCbd(e.target.value)} placeholder="pendiente" /></div>
        <div><label className="label" htmlFor="r-lab">Laboratorio</label><input id="r-lab" className="input" value={labName} onChange={(e) => setLabName(e.target.value)} /></div>
        <div><label className="label" htmlFor="r-date">Fecha del análisis</label><input id="r-date" type="date" className="input" value={labDate} onChange={(e) => setLabDate(e.target.value)} /></div>
        <div><label className="label" htmlFor="r-res">Resultado</label><input id="r-res" className="input" value={labResult} onChange={(e) => setLabResult(e.target.value)} placeholder="Aprobado / rechazado" /></div>
        <div><label className="label" htmlFor="r-sample">Muestra retenida (g)</label><input id="r-sample" className="input tnum" inputMode="decimal" value={sampleG} onChange={(e) => setSampleG(e.target.value)} /></div>
        <div><label className="label" htmlFor="r-until">Guardar hasta</label><input id="r-until" type="date" className="input" value={sampleUntil} onChange={(e) => setSampleUntil(e.target.value)} /></div>
      </div>
      <label className="check">
        <input type="checkbox" checked={noAnalysis} onChange={(e) => setNoAnalysis(e.target.checked)} />
        <span>Liberar sin análisis<span className="hint">La ficha del lote va a decir &quot;pendiente de análisis&quot;. No se inventa ningún valor.</span></span>
      </label>
      {error ? <div className="note note-warn" role="alert">{error}</div> : null}
      <div className="flex gap-2">
        <button className="btn" disabled={busy}>{busy ? "Firmando…" : "Firmar liberación"}</button>
        <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)} disabled={busy}>Cancelar</button>
      </div>
    </form>
  );
}

/** Recall: retira el lote del mercado y avisa en el portal a quien lo recibió (REA 5.4). */
export function RecallForm({ id, code, affected }: { id: string; code: string; affected: number }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (reason.trim().length < 5) {
      setError("Escribí el motivo del retiro: queda en el registro y lo ve el socio.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ affectedMembers: number }>(`/api/batches/${id}/recall`, { body: { reason: reason.trim() } });
      toast({ tone: "ok", title: "Lote retirado", text: `Se bloqueó ${code} y ${res.affectedMembers} socios verán el aviso en su portal.` });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div>
        <p className="cell-meta" style={{ margin: "0 0 10px" }}>
          Retirar el lote del mercado bloquea las entregas y avisa en el portal a los {affected} socios que lo recibieron.
        </p>
        <button className="btn btn-quiet" onClick={() => setOpen(true)}>Retirar del mercado</button>
      </div>
    );
  }

  return (
    <form className="stack" style={{ gap: 10 }} onSubmit={submit}>
      <div>
        <label className="label" htmlFor="rc-reason">Motivo del retiro</label>
        <input id="rc-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: análisis con contaminantes" />
      </div>
      {error ? <div className="note note-warn">{error}</div> : null}
      <div className="flex gap-2">
        <button className="btn" disabled={busy}>{busy ? "Retirando…" : "Confirmar retiro"}</button>
        <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)} disabled={busy}>Cancelar</button>
      </div>
    </form>
  );
}
