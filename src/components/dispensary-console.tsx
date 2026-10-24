"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Member = { id: string; legajo: number; name: string };
type Batch = { id: string; code: string; strain: string; balanceG: number; thcPct: number | null };
type Status = {
  member: { statusLabel: string; reprocannLabel: string; reprocannDays: number | null; forecastG: number | null };
  usage: { dayGrams: number; monthGrams: number };
  limits: { dailyG: number; monthlyG: number; thcMaxPct: number | null; isMinor: boolean; requiresReprocann: boolean };
  blockers: string[];
};

const g = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1).replace(".", ",")} g`;

function Meter({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = pct >= 100 ? "#dc2626" : pct >= 80 ? "#d97706" : "var(--brand)";
  return (
    <div className="meter">
      <span style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function DispensaryConsole({ members, batches, initialMemberId }: { members: Member[]; batches: Batch[]; initialMemberId?: string }) {
  const router = useRouter();
  const [memberId, setMemberId] = useState(
    initialMemberId && members.some((m) => m.id === initialMemberId) ? initialMemberId : (members[0]?.id ?? ""),
  );
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [grams, setGrams] = useState("5");
  const [remote, setRemote] = useState<{ id: string; data: Status | null }>({ id: "", data: null });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!memberId) return;
    let alive = true;
    fetch(`/api/members/${memberId}/status`)
      .then((r) => r.json())
      .then((d) => { if (alive) setRemote({ id: memberId, data: d }); })
      .catch(() => { if (alive) setError("No se pudo leer el estado del socio"); });
    return () => { alive = false; };
  }, [memberId]);

  const status = remote.id === memberId ? remote.data : null;
  const loading = Boolean(memberId) && !status;

  const batch = useMemo(() => batches.find((b) => b.id === batchId), [batches, batchId]);
  const amount = Number(grams.replace(",", ".")) || 0;
  const monthAfter = (status?.usage.monthGrams ?? 0) + amount;
  const dayAfter = (status?.usage.dayGrams ?? 0) + amount;
  const thcBlocked = Boolean(status?.limits.thcMaxPct != null && batch?.thcPct != null && batch.thcPct > status.limits.thcMaxPct);
  const overMonth = Boolean(status && monthAfter > status.limits.monthlyG);
  const overDay = Boolean(status && dayAfter > status.limits.dailyG);
  const overStock = Boolean(batch && amount > batch.balanceG);
  const blocked = Boolean(status && (status.blockers.length > 0 || thcBlocked || overMonth || overDay || overStock || amount <= 0));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setOk(null); setBusy(true);
    try {
      const res = await fetch("/api/dispensations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, batchId, grams: amount, signatureType: "PIN" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`${data.error ?? "ERROR"}: ${data.message ?? "no se pudo entregar"}`);
      setOk(`Entregado. Saldo del lote ${batch?.code}: ${g(data.balanceAfterG)}.`);
      setRemote((s) =>
        s.data
          ? { id: s.id, data: { ...s.data, usage: { dayGrams: s.data.usage.dayGrams + amount, monthGrams: s.data.usage.monthGrams + amount } } }
          : s,
      );
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dashboard-grid">
      <form className="card card-pad" onSubmit={submit}>
        <div className="section-title mb-3">Nueva entrega</div>

        <div className="mb-3">
          <label className="label" htmlFor="member">Socio</label>
          <select id="member" className="select" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.legajo} · {m.name}</option>
            ))}
          </select>
          {members.length === 0 ? <p className="cell-meta mt-1">No hay socios activos. Activá uno desde Socios.</p> : null}
        </div>

        <div className="mb-3">
          <label className="label" htmlFor="batch">Lote</label>
          <select id="batch" className="select" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.code} · {b.strain} · {g(b.balanceG)}{b.thcPct != null ? ` · ${b.thcPct}% THC` : ""}</option>
            ))}
          </select>
          {batches.length === 0 ? <p className="cell-meta mt-1">No hay lotes disponibles en esta etapa.</p> : null}
        </div>

        <div className="mb-3 flex gap-3 items-end">
          <div style={{ flex: 1 }}>
            <label className="label" htmlFor="grams">Gramos a entregar</label>
            <input id="grams" className="input tnum" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} />
          </div>
          <div className="flex gap-1">
            {[2, 5, 10].map((v) => (
              <button key={v} type="button" className="btn btn-secondary btn-sm" onClick={() => setGrams(String(v))}>{v} g</button>
            ))}
          </div>
        </div>

        <button className="btn" disabled={busy || blocked || !memberId || !batchId}>
          {busy ? "Validando y registrando…" : "Confirmar entrega"}
        </button>

        {blocked && !busy ? (
          <p className="cell-meta mt-2">
            La entrega está bloqueada por el chequeo de la derecha. El servidor vuelve a validarlo igual.
          </p>
        ) : null}
        {error ? <div className="alert alert-danger mt-3">{error}</div> : null}
        {ok ? <div className="alert alert-ok mt-3">{ok}</div> : null}
      </form>

      <div className="card card-pad">
        <div className="flex items-center justify-between">
          <div className="section-title">Chequeo previo</div>
          {loading ? <span className="cell-meta">leyendo…</span> : null}
        </div>

        {!status ? (
          <p className="cell-meta mt-3">Elegí un socio para ver su estado y sus topes.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <span className="chip chip-brand">{status.member.statusLabel}</span>
              <span className={`chip ${status.member.reprocannDays !== null && status.member.reprocannDays < 0 ? "chip-danger" : status.blockers.length ? "chip-warn" : "chip-ok"}`}>
                {status.member.reprocannLabel}
              </span>
              {status.member.forecastG ? <span className="chip">previsión {g(status.member.forecastG)}/mes</span> : null}
              {status.limits.isMinor ? <span className="chip chip-warn">menor de 21</span> : null}
            </div>

            {status.blockers.length > 0 ? (
              <div className="alert alert-danger mt-3">
                <strong>No puede retirar:</strong> {status.blockers.join(" · ")}
              </div>
            ) : null}

            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <span className="cell-meta">Mes en curso</span>
                <span className="text-[13px] tnum">{g(monthAfter)} / {g(status.limits.monthlyG)}</span>
              </div>
              <Meter value={monthAfter} max={status.limits.monthlyG} />
              <div className="flex items-baseline justify-between mt-3">
                <span className="cell-meta">Hoy</span>
                <span className="text-[13px] tnum">{g(dayAfter)} / {g(status.limits.dailyG)}</span>
              </div>
              <Meter value={dayAfter} max={status.limits.dailyG} />
            </div>

            {batch ? (
              <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--line-soft)" }}>
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="cell-meta">Stock del lote {batch.code}</span>
                  <span className="tnum">{g(batch.balanceG)} → {g(Math.max(0, batch.balanceG - amount))}</span>
                </div>
                {status.limits.thcMaxPct != null ? (
                  <div className="flex items-baseline justify-between text-[13px] mt-1">
                    <span className="cell-meta">THC del lote</span>
                    <span className={thcBlocked ? "chip chip-danger" : "chip"}>
                      {batch.thcPct != null ? `${batch.thcPct}%` : "sin dato"} · máximo {status.limits.thcMaxPct}%
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-1.5">
              {overMonth ? <span className="chip chip-danger">supera el tope mensual</span> : null}
              {overDay ? <span className="chip chip-danger">supera el tope diario</span> : null}
              {overStock ? <span className="chip chip-danger">stock insuficiente en el lote</span> : null}
              {thcBlocked ? <span className="chip chip-danger">THC fuera del límite para su edad</span> : null}
              {!blocked ? <span className="chip chip-ok">habilitado para {g(amount)}</span> : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
