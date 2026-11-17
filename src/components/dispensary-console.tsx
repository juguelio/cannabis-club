"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Info, ReceiptText, RotateCcw, TriangleAlert } from "lucide-react";
import { api, ApiError, errMsg } from "@/lib/client";
import { MemberPicker, type PickerMember } from "./member-picker";
import { useToast } from "./toast";

type Batch = { id: string; code: string; strain: string; balanceG: number; thcPct: number | null };
type QueueItem = { key: string; memberId: string; time: string | null; name: string; legajo: number; pickupId: string | null; pickupG: number | null; pickupItems: { strainName: string; grams: number }[]; status: string };
type Status = {
  member: { name: string; legajo: number; statusLabel: string; reprocannLabel: string; reprocannDays: number | null; forecastG: number | null };
  usage: { dayGrams: number; monthGrams: number };
  limits: { dailyG: number; monthlyG: number; thcMaxPct: number | null; isMinor: boolean; requiresReprocann: boolean };
  blockers: string[];
};
type Receipt = { id: string; replay: boolean; member: string; memberId: string; grams: number; batch: string; balanceAfter: number; exhausted: boolean; pickup: boolean };

const g = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1).replace(".", ",")} g`;
// La reserva se imputa por variedad: «5 g Tangie · 10 g Grape Gas», nunca sólo el total.
const itemsLabel = (items: { strainName: string; grams: number }[]) => items.map((i) => `${g(i.grams)} ${i.strainName}`).join(" · ");
const r2 = (v: number) => Math.round(v * 100) / 100;

export function DispensaryConsole({
  members,
  batches,
  queue,
  initialMemberId,
  initialPickupId,
}: {
  members: PickerMember[];
  batches: Batch[];
  queue: QueueItem[];
  initialMemberId?: string;
  initialPickupId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const initial = initialMemberId && members.some((m) => m.id === initialMemberId) ? initialMemberId : "";
  // Una reserva sólo se cierra si el mostrador la atiende explícitamente (R01): por enlace o tocándola en la cola.
  const initialRes = initial ? queue.find((q) => q.memberId === initial && q.pickupId && (!initialPickupId || q.pickupId === initialPickupId)) : undefined;
  const [memberId, setMemberId] = useState(initial);
  const [batchId, setBatchId] = useState(batches.length === 1 ? batches[0].id : "");
  const [grams, setGrams] = useState(initialRes?.pickupG ? String(initialRes.pickupG) : "");
  const [pickupId, setPickupId] = useState<string | null>(initialRes?.pickupId ?? null);
  const [remote, setRemote] = useState<{ id: string; data: Status | null; error?: string }>({ id: "", data: null });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ code: string; message: string } | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const readout = useRef<HTMLInputElement>(null);
  // Clave del intento (R07): reintentar la misma entrega devuelve la ya registrada, no un asiento nuevo.
  const newKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const [intentKey, setIntentKey] = useState(newKey);

  useEffect(() => {
    if (!memberId) return;
    let alive = true;
    api<Status>(`/api/members/${memberId}/status`)
      .then((d) => { if (alive) setRemote({ id: memberId, data: d }); })
      .catch((e) => { if (alive) setRemote({ id: memberId, data: null, error: errMsg(e) }); });
    return () => { alive = false; };
  }, [memberId]);

  const status = remote.id === memberId ? remote.data : null;
  const loading = Boolean(memberId) && remote.id !== memberId;
  const batch = useMemo(() => batches.find((b) => b.id === batchId), [batches, batchId]);
  const amount = Number(grams.replace(",", ".")) || 0;

  const dayLeft = status ? r2(Math.max(0, status.limits.dailyG - status.usage.dayGrams)) : 0;
  const monthLeft = status ? r2(Math.max(0, status.limits.monthlyG - status.usage.monthGrams)) : 0;
  const maxAllowed = status ? Math.min(dayLeft, monthLeft, batch?.balanceG ?? Infinity) : 0;

  const checks: { tone: "ok" | "bad" | "warn"; text: string }[] = [];
  if (status) {
    for (const b of status.blockers) checks.push({ tone: "bad", text: b });
    if (batch && status.limits.thcMaxPct != null && batch.thcPct != null && batch.thcPct > status.limits.thcMaxPct)
      checks.push({ tone: "bad", text: `El lote tiene ${batch.thcPct}% THC; por su edad el máximo es ${status.limits.thcMaxPct}%.` });
    if (amount > 0 && status.usage.dayGrams + amount > status.limits.dailyG + 1e-9) checks.push({ tone: "bad", text: `Supera el tope diario: le quedan ${g(dayLeft)} hoy.` });
    if (amount > 0 && status.usage.monthGrams + amount > status.limits.monthlyG + 1e-9) checks.push({ tone: "bad", text: `Supera el tope mensual: le quedan ${g(monthLeft)} este mes.` });
    if (batch && amount > batch.balanceG + 1e-9) checks.push({ tone: "bad", text: `El lote ${batch.code} tiene ${g(batch.balanceG)}.` });
    if (status.member.reprocannDays != null && status.member.reprocannDays >= 0 && status.member.reprocannDays <= 30)
      checks.push({ tone: "warn", text: `Su REPROCANN vence en ${status.member.reprocannDays} días: recordale renovarlo.` });
  }
  const blocked = checks.some((c) => c.tone === "bad");
  const ready = Boolean(status && batch && amount > 0 && !blocked);

  async function submit(confirmDuplicate = false) {
    if (!ready || !batch || !status) return;
    setBusy(true);
    setFailure(null);
    try {
      const res = await api<{ dispensation: { id: string }; balanceAfterG: number | null; pickupFulfilled: string | null; batchExhausted: boolean; replay: boolean }>("/api/dispensations", {
        body: { memberId, batchId, grams: amount, pickupId: pickupId ?? undefined, idempotencyKey: intentKey, confirmDuplicate },
      });
      setReceipt({
        id: res.dispensation.id,
        replay: res.replay,
        member: status.member.name,
        memberId,
        grams: amount,
        batch: `${batch.code} · ${batch.strain}`,
        balanceAfter: res.balanceAfterG ?? batch.balanceG - amount,
        exhausted: res.batchExhausted,
        pickup: Boolean(res.pickupFulfilled),
      });
      toast({ tone: "ok", title: res.replay ? "Esa entrega ya estaba registrada" : `Entregados ${g(amount)}`, text: `${status.member.name}, lote ${batch.code}.` });
      router.refresh();
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError("ERROR", errMsg(err), 0);
      setFailure({ code: e.code, message: e.message });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setIntentKey(newKey());
    setReceipt(null);
    setMemberId("");
    setGrams("");
    setPickupId(null);
    setFailure(null);
    setRemote({ id: "", data: null });
  }

  const selectMember = (id: string, picked?: QueueItem) => {
    // Si el socio tiene una reserva abierta, la entrega la toma: gramos precargados.
    const item = picked ?? queue.find((q) => q.memberId === id && q.pickupId);
    setMemberId(id);
    setFailure(null);
    setReceipt(null);
    setPickupId(item?.pickupId ?? null);
    setGrams(item?.pickupG ? String(item.pickupG) : "");
    setTimeout(() => readout.current?.focus(), 50);
  };

  const presets = [2, 5, 10, 20].filter((p) => !status || p <= maxAllowed + 1e-9);
  const reserved = pickupId ? queue.find((q) => q.pickupId === pickupId)?.pickupG ?? null : null;
  const reservedItems = pickupId ? queue.find((q) => q.pickupId === pickupId)?.pickupItems ?? [] : [];
  const monthPct = (v: number) => (status ? Math.min(100, (v / status.limits.monthlyG) * 100) : 0);
  const dayPct = (v: number) => (status ? Math.min(100, (v / status.limits.dailyG) * 100) : 0);

  return (
    <div className="counter">
      <div className="stack">
        <section className="panel">
          <div className="panel-body" style={{ paddingTop: 16 }}>
            <MemberPicker members={members} value={memberId} onChange={(id) => selectMember(id)} autoFocus={!initialMemberId} label="¿Quién retira?" />
          </div>
          {queue.length ? (
            <>
              <div className="panel-head" style={{ paddingTop: 4 }}>
                <div><h2 className="panel-title" style={{ fontSize: 15 }}>Esperados hoy</h2><p className="panel-sub">Turnos y reservas del portal. Tocá para empezar la entrega.</p></div>
              </div>
              <ul className="rows queue">
                {queue.map((q) => (
                  <li key={q.key} aria-current={q.memberId === memberId ? "true" : undefined} onClick={() => selectMember(q.memberId, q)}>
                    <span className="time-tag">{q.time ?? "—"}</span>
                    <div className="grow">
                      <div className="cell-main truncate">{q.name}</div>
                      <div className="cell-meta">Legajo {q.legajo}{q.pickupG ? ` · reservó ${g(q.pickupG)}` : ""}</div>
                      {q.pickupItems.length ? <div className="cell-meta">{itemsLabel(q.pickupItems)}</div> : null}
                    </div>
                    {q.status === "CONFIRMADO" || q.status === "CONFIRMADA" ? <span className="chip chip-ok">Confirmado</span> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel-head"><div><h2 className="panel-title" style={{ fontSize: 15 }}>Lote</h2><p className="panel-sub">Sólo lotes disponibles, con su saldo del libro.</p></div></div>
          <div className="panel-body lot-pick" role="radiogroup" aria-label="Lote a entregar">
            {batches.length === 0 ? <p className="muted" style={{ margin: 0 }}>No hay lotes disponibles. Registrá un peso seco en <Link href="/stock">Stock</Link>.</p> : null}
            {batches.map((b) => {
              const thcBlocked = status?.limits.thcMaxPct != null && b.thcPct != null && b.thcPct > status.limits.thcMaxPct;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={b.id === batchId}
                  className="lot"
                  aria-disabled={thcBlocked || undefined}
                  onClick={() => { setBatchId(b.id); setFailure(null); }}
                >
                  <span className="lot-dot" aria-hidden />
                  <span style={{ minWidth: 0 }}>
                    <span className="cell-main" style={{ display: "block" }}>{b.strain}</span>
                    <span className="cell-meta">{b.code}{b.thcPct != null ? ` · ${b.thcPct}% THC` : ""}{thcBlocked ? " · no apto por edad" : ""}</span>
                  </span>
                  <span className="lot-g">{g(b.balanceG)}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <section className="scale" aria-label="Balanza de la entrega" aria-live="polite">
        {receipt ? (
          <div className="stack" style={{ gap: 16 }}>
            <div className="flex items-center gap-2" style={{ color: "#a6e8bf" }}>
              <CircleCheck aria-hidden /> {receipt.replay ? "Esa entrega ya estaba registrada: no se duplicó" : "Entrega registrada"}
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--on-dark-3)" }}>Comprobante {receipt.id.slice(-8).toUpperCase()}</span>
            </div>
            <div className="readout" style={{ margin: 0, borderBottom: 0 }}>
              <span className="readout-value" style={{ width: "auto" }}>{String(receipt.grams).replace(".", ",")}</span>
              <span className="readout-unit">g</span>
            </div>
            <div>
              <div className="scale-name">{receipt.member}</div>
              <div className="scale-meta">Lote {receipt.batch}. Quedan {g(receipt.balanceAfter)} en el lote{receipt.exhausted ? ", que pasó a agotado" : ""}.</div>
              {receipt.pickup ? <div className="scale-meta" style={{ marginTop: 4 }}>La reserva del portal quedó cerrada como retirada.</div> : null}
              <div className="scale-meta" style={{ marginTop: 4 }}>Firma: registrada por el operador (no prueba recepción del socio).</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-lg" onClick={reset} autoFocus><RotateCcw aria-hidden />Nueva entrega</button>
              <Link className="btn btn-lg btn-quiet" href={`/socios/${receipt.memberId}`} style={{ background: "transparent", color: "#d5e5db", borderColor: "#355a4b" }}>
                <ReceiptText aria-hidden />Ver legajo
              </Link>
            </div>
          </div>
        ) : !memberId ? (
          <div className="scale-empty">
            <div>
              <b>Elegí al socio</b>
              Buscalo por legajo, apellido o DNI, o tocá un turno de la lista.
              <div style={{ marginTop: 14, fontSize: 13 }}>Atajo: <span className="kbd" style={{ background: "transparent", color: "#d5e5db", borderColor: "#355a4b" }}>/</span> busca en todo el club.</div>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <div className="scale-member">
              <span className="avatar" aria-hidden>{status ? status.member.name.split(", ").reverse().map((p) => p[0]).join("") : "··"}</span>
              <div style={{ minWidth: 0 }}>
                <div className="scale-name truncate">{status ? status.member.name : loading ? "Leyendo legajo…" : "—"}</div>
                <div className="scale-meta">
                  {status ? `Legajo ${status.member.legajo} · ${status.member.reprocannLabel}${status.limits.isMinor ? " · menor de 21" : ""}` : remote.error ?? " "}
                </div>
              </div>
            </div>

            <div className="readout">
              <label className="readout-field">
                <span className="sr-only">Gramos a entregar</span>
                <input
                  ref={readout}
                  className="readout-value"
                  inputMode="decimal"
                  placeholder="0"
                  value={grams}
                  style={{ width: `${Math.max(1, grams.length) * 0.58 + 0.1}em` }}
                  onChange={(e) => { setGrams(e.target.value.replace(/[^\d.,]/g, "")); setFailure(null); }}
                  aria-describedby="scale-verdict"
                />
              </label>
              <span className="readout-unit">g</span>
            </div>
            <div className="presets" role="group" aria-label="Cantidades rápidas">
              {reserved ? <button type="button" aria-pressed={amount === reserved} onClick={() => setGrams(String(reserved))}>Reservó {g(reserved)}</button> : null}
              {presets.map((p) => <button key={p} type="button" aria-pressed={amount === p && reserved !== p} onClick={() => setGrams(String(p))}>{p} g</button>)}
              {status && maxAllowed > 0 && Number.isFinite(maxAllowed) && !presets.includes(maxAllowed) ? (
                <button type="button" aria-pressed={amount === maxAllowed} onClick={() => setGrams(String(r2(maxAllowed)))}>Máximo {g(r2(maxAllowed))}</button>
              ) : null}
            </div>

            {status ? (
              <div className="gauge">
                <div className="gauge-row"><span>Mes</span><span><b>{g(r2(status.usage.monthGrams + amount))}</b> de {g(status.limits.monthlyG)}</span></div>
                <div className="gauge-track" data-over={status.usage.monthGrams + amount > status.limits.monthlyG + 1e-9}>
                  <span className="gauge-used" style={{ width: `${monthPct(status.usage.monthGrams)}%` }} />
                  <span className="gauge-now" style={{ left: `${monthPct(status.usage.monthGrams)}%`, width: `${Math.max(0, monthPct(status.usage.monthGrams + amount) - monthPct(status.usage.monthGrams))}%` }} />
                </div>
                <div className="gauge-row" style={{ marginTop: 12 }}><span>Hoy</span><span><b>{g(r2(status.usage.dayGrams + amount))}</b> de {g(status.limits.dailyG)}</span></div>
                <div className="gauge-track" data-over={status.usage.dayGrams + amount > status.limits.dailyG + 1e-9}>
                  <span className="gauge-used" style={{ width: `${dayPct(status.usage.dayGrams)}%` }} />
                  <span className="gauge-now" style={{ left: `${dayPct(status.usage.dayGrams)}%`, width: `${Math.max(0, dayPct(status.usage.dayGrams + amount) - dayPct(status.usage.dayGrams))}%` }} />
                </div>
              </div>
            ) : null}

            <div className="scale-verdict" id="scale-verdict">
              {failure ? (
                <div className="verdict" data-tone={failure.code === "DUPLICATE_SUSPECTED" ? "warn" : "bad"}>
                  <TriangleAlert aria-hidden />
                  <span style={{ flex: 1 }}>{failure.message}</span>
                  {failure.code === "DUPLICATE_SUSPECTED" ? (
                    <button type="button" className="btn btn-sm" onClick={() => submit(true)} disabled={busy}>Es otra entrega</button>
                  ) : null}
                </div>
              ) : null}
              {checks.map((c) => (
                <div key={c.text} className="verdict" data-tone={c.tone}>
                  {c.tone === "bad" ? <CircleAlert aria-hidden /> : <Info aria-hidden />}
                  <span>{c.text}</span>
                </div>
              ))}
              {pickupId && reserved != null ? (
                <div className="verdict">
                  <Info aria-hidden />
                  <span style={{ flex: 1 }}>Atendés su reserva del portal de {g(reserved)}{reservedItems.length ? `: ${itemsLabel(reservedItems)}` : ""}. Esta entrega la cierra{amount && Math.abs(amount - reserved) > 0.001 ? " (queda registrado que fue distinto de lo reservado)" : ""}.</span>
                  <button type="button" className="btn btn-sm" style={{ background: "transparent", color: "#d5e5db", borderColor: "#355a4b" }} onClick={() => setPickupId(null)}>No es la reserva</button>
                </div>
              ) : null}
              {status && !batch ? <div className="verdict"><Info aria-hidden />Elegí el lote a entregar.</div> : null}
              {ready && !failure ? (
                <div className="verdict" data-tone="ok"><CircleCheck aria-hidden />Habilitado: {g(amount)} de {batch!.strain}. El servidor lo vuelve a validar al confirmar.</div>
              ) : null}
            </div>

            <button className="btn btn-lg btn-block" style={{ marginTop: 18 }} disabled={!ready || busy}>
              {busy ? "Registrando…" : ready ? `Confirmar entrega de ${g(amount)}` : "Confirmar entrega"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
