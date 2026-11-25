"use client";

import { ValidatedForm, Input } from "./validated-form";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Info, ReceiptText, RotateCcw, TriangleAlert } from "lucide-react";
import { api, ApiError, errMsg } from "@/lib/client";
import { draftLines, gramsOf, lineProblems, pickupCoverage, round2, setProblems, type PickupLine } from "@/lib/pickup-lines";
import { MemberPicker, type PickerMember } from "./member-picker";
import { useToast } from "./toast";

type Batch = { id: string; code: string; strain: string; strainId: string; balanceG: number; thcPct: number | null };
type QueueItem = {
  key: string;
  memberId: string;
  time: string | null;
  name: string;
  legajo: number;
  pickupId: string | null;
  pickupG: number | null;
  pickupItems: { id: string; strainId: string; strainName: string; grams: number }[];
  status: string;
};
type Status = {
  member: { name: string; legajo: number; statusLabel: string; reprocannLabel: string; reprocannDays: number | null; forecastG: number | null };
  usage: { dayGrams: number; monthGrams: number };
  limits: { perOrderG: number; monthlyG: number; thcMaxPct: number | null; isMinor: boolean; requiresReprocann: boolean };
  blockers: string[];
};
type ReceiptRow = { strainName: string; grams: number; batch: string };
type Receipt = {
  replay: boolean;
  member: string;
  memberId: string;
  rows: ReceiptRow[];
  totalG: number;
  pickupClosed: boolean;
  pending: string[];
  exhausted: boolean;
  firstId: string;
};

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
  // Atender una reserva con variedades: una fila por genética, con la cantidad reservada ya puesta.
  const [lines, setLines] = useState<PickupLine[]>(() => (initialRes?.pickupItems?.length ? draftLines(initialRes.pickupItems) : []));
  const [mode, setMode] = useState<"variedad" | "total">("variedad");
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

  const perOrderLeft = status ? status.limits.perOrderG : 0;
  const monthLeft = status ? r2(Math.max(0, status.limits.monthlyG - status.usage.monthGrams)) : 0;
  const maxAllowed = status ? Math.min(perOrderLeft, monthLeft, batch?.balanceG ?? Infinity) : 0;

  const reserved = pickupId ? queue.find((q) => q.pickupId === pickupId)?.pickupG ?? null : null;
  const reservedItems = pickupId ? queue.find((q) => q.pickupId === pickupId)?.pickupItems ?? [] : [];
  // Con variedades reservadas el mostrador imputa por variedad; «por total» queda como salida para
  // una reserva cuya genética ya no tiene lote con saldo.
  const byVariety = Boolean(pickupId) && reservedItems.length > 0 && mode === "variedad";
  const limitsForLines = status
    ? { perOrderG: status.limits.perOrderG, monthlyG: status.limits.monthlyG, usage: status.usage, thcMaxPct: status.limits.thcMaxPct }
    : null;
  const lineIssues = byVariety
    ? lines.flatMap((l) => lineProblems(l, batches, limitsForLines).filter((p) => p.tone === "bad").map((p) => ({ ...p, key: `${l.pickupItemId}-${p.text}` })))
    : [];
  const setIssues = byVariety ? setProblems(lines, limitsForLines) : [];
  const coverage = byVariety ? pickupCoverage(reservedItems, lines) : null;
  const linesTotal = byVariety ? round2(lines.reduce((a, l) => a + gramsOf(l.grams), 0)) : 0;

  const checks: { tone: "ok" | "bad" | "warn"; text: string }[] = [];
  if (status) {
    for (const b of status.blockers) checks.push({ tone: "bad", text: b });
    if (batch && status.limits.thcMaxPct != null && batch.thcPct != null && batch.thcPct > status.limits.thcMaxPct)
      checks.push({ tone: "bad", text: `El lote tiene ${batch.thcPct}% THC; por su edad el máximo es ${status.limits.thcMaxPct}%.` });
    if (amount > 0 && amount > status.limits.perOrderG + 1e-9)
      checks.push({ tone: "bad", text: `El tope por pedido es ${g(status.limits.perOrderG)}: esta entrega lleva ${g(amount)}.` });
    if (amount > 0 && status.usage.monthGrams + amount > status.limits.monthlyG + 1e-9) checks.push({ tone: "bad", text: `Supera el tope mensual: le quedan ${g(monthLeft)} este mes.` });
    if (batch && amount > batch.balanceG + 1e-9) checks.push({ tone: "bad", text: `El lote ${batch.code} tiene ${g(batch.balanceG)}.` });
    if (status.member.reprocannDays != null && status.member.reprocannDays >= 0 && status.member.reprocannDays <= 30)
      checks.push({ tone: "warn", text: `Su REPROCANN vence en ${status.member.reprocannDays} días: recordale renovarlo.` });
  }
  const blocked = checks.some((c) => c.tone === "bad");
  const ready = Boolean(status && batch && amount > 0 && !blocked);
  const readyVariety = Boolean(status && coverage && coverage.assignedG > 0 && !lineIssues.length && !setIssues.length && !blocked);

  async function submit(confirmDuplicate = false) {
    if (!ready || !batch || !status) return;
    setBusy(true);
    setFailure(null);
    try {
      const res = await api<{ dispensation: { id: string }; balanceAfterG: number | null; pickupFulfilled: string | null; batchExhausted: boolean; replay: boolean }>("/api/dispensations", {
        body: { memberId, batchId, grams: amount, pickupId: pickupId ?? undefined, idempotencyKey: intentKey, confirmDuplicate },
      });
      setReceipt({
        replay: res.replay,
        member: status.member.name,
        memberId,
        rows: [{ strainName: batch.strain, grams: amount, batch: batch.code }],
        totalG: amount,
        pickupClosed: Boolean(res.pickupFulfilled),
        pending: [],
        exhausted: res.batchExhausted,
        firstId: res.dispensation.id,
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

  async function submitVariety() {
    if (!readyVariety || !status || !pickupId) return;
    setBusy(true);
    setFailure(null);
    try {
      const res = await api<{
        dispensations: { id: string; grams: number; batchCode: string; strainName: string }[];
        complete: boolean | null;
        deliveredG: number;
        remainingG: number | null;
        pending: string[];
        replay: boolean;
      }>("/api/dispensations/pickup", {
        body: {
          pickupId,
          idempotencyKey: intentKey,
          lines: lines.map((l) => ({ pickupItemId: l.pickupItemId, batchId: l.batchId, grams: gramsOf(l.grams) })),
        },
      });
      setReceipt({
        replay: res.replay,
        member: status.member.name,
        memberId,
        rows: res.dispensations.map((d) => ({ strainName: d.strainName, grams: Number(d.grams), batch: d.batchCode })),
        totalG: res.deliveredG,
        pickupClosed: res.complete === true,
        pending: res.pending ?? [],
        exhausted: false,
        firstId: res.dispensations[0]?.id ?? "",
      });
      toast({
        tone: "ok",
        title: res.replay ? "Esa entrega ya estaba registrada" : `Entregados ${g(res.deliveredG)}`,
        text: res.complete ? "La reserva quedó cerrada como retirada." : `La reserva sigue abierta: falta ${(res.pending ?? []).join(", ")}.`,
      });
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
    setLines([]);
    setMode("variedad");
    setFailure(null);
    setRemote({ id: "", data: null });
  }

  const selectMember = (id: string, picked?: QueueItem) => {
    // Si el socio tiene una reserva abierta, la entrega la toma: gramos y variedades precargados.
    const item = picked ?? queue.find((q) => q.memberId === id && q.pickupId);
    setMemberId(id);
    setFailure(null);
    setReceipt(null);
    setPickupId(item?.pickupId ?? null);
    setGrams(item?.pickupG ? String(item.pickupG) : "");
    setLines(item?.pickupItems?.length ? draftLines(item.pickupItems) : []);
    setMode("variedad");
    setTimeout(() => readout.current?.focus(), 50);
  };

  const setLine = (pickupItemId: string, patch: Partial<PickupLine>) =>
    setLines((prev) => prev.map((l) => (l.pickupItemId === pickupItemId ? { ...l, ...patch } : l)));

  const presets = [2, 5, 10, 20].filter((p) => !status || p <= maxAllowed + 1e-9);
  const monthPct = (v: number) => (status ? Math.min(100, (v / status.limits.monthlyG) * 100) : 0);
  const dayPct = (v: number) => (status ? Math.min(100, (v / status.limits.perOrderG) * 100) : 0);
  const deliveredDraft = byVariety ? linesTotal : amount;

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
          <div className="panel-head">
            <div>
              <h2 className="panel-title" style={{ fontSize: 15 }}>{byVariety ? "Variedades reservadas" : "Lote"}</h2>
              <p className="panel-sub">
                {byVariety
                  ? "Cada variedad reservada se imputa contra un lote de esa genética. La cantidad viene puesta; si entregás otra cosa, queda registrado."
                  : "Sólo lotes disponibles, con su saldo del libro."}
              </p>
            </div>
          </div>
          {byVariety ? (
            <div className="panel-body" style={{ display: "grid", gap: 12 }}>
              {lines.map((l) => {
                const candidates = batches.filter((b) => b.strainId === l.strainId && b.balanceG > 0);
                const chosen = batches.find((b) => b.id === l.batchId);
                const issues = lineProblems(l, batches, limitsForLines).filter((p) => p.tone === "bad" && chosen);
                return (
                  <div
                    key={l.pickupItemId}
                    style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, display: "grid", gap: 8, minWidth: 0 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between", minWidth: 0 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="cell-main truncate">{l.strainName}</div>
                        <div className="cell-meta">Reservó {g(l.reservedG)}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <label className="readout-field">
                          <span className="sr-only">Gramos de {l.strainName}</span>
                          <input
                            className="readout-value"
                            inputMode="decimal"
                            aria-invalid={issues.length > 0 || undefined}
                            aria-describedby={issues.length ? `problema-${l.pickupItemId}` : undefined}
                            value={l.grams}
                            style={{ width: `${Math.max(1, l.grams.length) * 0.58 + 0.1}em` }}
                            onChange={(e) => { setLine(l.pickupItemId, { grams: e.target.value.replace(/[^\d.,]/g, "") }); setFailure(null); }}
                          />
                        </label>
                        <span className="readout-unit">g</span>
                      </div>
                    </div>
                    {candidates.length ? (
                      <select
                        className="select"
                        aria-label={`Lote de ${l.strainName}`}
                        aria-describedby={issues.length ? `problema-${l.pickupItemId}` : undefined}
                        value={l.batchId}
                        onChange={(e) => { setLine(l.pickupItemId, { batchId: e.target.value }); setFailure(null); }}
                      >
                        <option value="">Elegir lote…</option>
                        {candidates.map((b) => (
                          <option key={b.id} value={b.id}>{b.code} · {g(b.balanceG)}{b.thcPct != null ? ` · ${b.thcPct}% THC` : ""}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="cell-meta" style={{ margin: 0 }}>No hay lote de {l.strainName} con saldo: esta variedad no se puede entregar hoy.</p>
                    )}
                    <div id={`problema-${l.pickupItemId}`}>{issues.map((p) => (
                      <div key={p.text} className="verdict" data-tone="bad"><CircleAlert aria-hidden /><span>{p.text}</span></div>
                    ))}</div>
                  </div>
                );
              })}
            </div>
          ) : (
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
          )}
        </section>
      </div>

      <section className="scale" aria-label="Balanza de la entrega" aria-live="polite">
        {receipt ? (
          <div className="stack" style={{ gap: 16 }}>
            <div className="flex items-center gap-2" style={{ color: "#a6e8bf" }}>
              <CircleCheck aria-hidden /> {receipt.replay ? "Esa entrega ya estaba registrada: no se duplicó" : "Entrega registrada"}
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--on-dark-3)" }}>
                {receipt.rows.length > 1 ? `${receipt.rows.length} comprobantes` : `Comprobante ${receipt.firstId.slice(-8).toUpperCase()}`}
              </span>
            </div>
            <div className="readout" style={{ margin: 0, borderBottom: 0 }}>
              <span className="readout-value" style={{ width: "auto" }}>{String(receipt.totalG).replace(".", ",")}</span>
              <span className="readout-unit">g</span>
            </div>
            <div>
              <div className="scale-name">{receipt.member}</div>
              {receipt.rows.map((r) => (
                <div key={`${r.batch}-${r.strainName}`} className="scale-meta">{g(r.grams)} {r.strainName} · lote {r.batch}</div>
              ))}
              {receipt.pickupClosed ? <div className="scale-meta" style={{ marginTop: 4 }}>La reserva del portal quedó cerrada como retirada.</div> : null}
              {receipt.pending.length ? <div className="scale-meta" style={{ marginTop: 4 }}>La reserva sigue abierta: falta {receipt.pending.join(", ")}.</div> : null}
              {receipt.exhausted ? <div className="scale-meta" style={{ marginTop: 4 }}>El lote pasó a agotado.</div> : null}
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
          <ValidatedForm onSubmit={(e) => { e.preventDefault(); void (byVariety ? submitVariety() : submit()); }}>
            <div className="scale-member">
              <span className="avatar" aria-hidden>{status ? status.member.name.split(", ").reverse().map((p) => p[0]).join("") : "··"}</span>
              <div style={{ minWidth: 0 }}>
                <div className="scale-name truncate">{status ? status.member.name : loading ? "Leyendo legajo…" : "—"}</div>
                <div className="scale-meta">
                  {status ? `Legajo ${status.member.legajo} · ${status.member.reprocannLabel}${status.limits.isMinor ? " · menor de 21" : ""}` : remote.error ?? " "}
                </div>
              </div>
            </div>

            {byVariety ? (
              <div className="readout">
                <span className="readout-value" style={{ width: "auto" }}>{String(linesTotal).replace(".", ",")}</span>
                <span className="readout-unit">g</span>
                <span className="scale-meta" style={{ marginLeft: 12 }}>Reservó {g(reserved ?? 0)}</span>
              </div>
            ) : (
              <>
                <div className="readout">
                  <label className="readout-field">
                    <span className="sr-only">Gramos a entregar</span>
                    <Input
                      ref={readout}
                      className="readout-value"
                      inputMode="decimal"
                      placeholder="0"
                      aria-invalid={grams.length > 0 && (!Number.isFinite(amount) || amount <= 0 || amount > maxAllowed) || undefined}
                      name="grams" value={grams}
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
              </>
            )}

            {status ? (
              <div className="gauge">
                <div className="gauge-row"><span>Mes</span><span><b>{g(r2(status.usage.monthGrams + deliveredDraft))}</b> de {g(status.limits.monthlyG)}</span></div>
                <div className="gauge-track" data-over={status.usage.monthGrams + deliveredDraft > status.limits.monthlyG + 1e-9}>
                  <span className="gauge-used" style={{ width: `${monthPct(status.usage.monthGrams)}%` }} />
                  <span className="gauge-now" style={{ left: `${monthPct(status.usage.monthGrams)}%`, width: `${Math.max(0, monthPct(status.usage.monthGrams + deliveredDraft) - monthPct(status.usage.monthGrams))}%` }} />
                </div>
                <div className="gauge-row" style={{ marginTop: 12 }}><span>Hoy</span><span><b>{g(r2(status.usage.dayGrams + deliveredDraft))}</b> de {g(status.limits.perOrderG)}</span></div>
                <div className="gauge-track" data-over={status.usage.dayGrams + deliveredDraft > status.limits.perOrderG + 1e-9}>
                  <span className="gauge-used" style={{ width: `${dayPct(status.usage.dayGrams)}%` }} />
                  <span className="gauge-now" style={{ left: `${dayPct(status.usage.dayGrams)}%`, width: `${Math.max(0, dayPct(status.usage.dayGrams + deliveredDraft) - dayPct(status.usage.dayGrams))}%` }} />
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
              {setIssues.map((p) => (
                <div key={p.text} className="verdict" data-tone={p.tone}>
                  {p.tone === "bad" ? <CircleAlert aria-hidden /> : <Info aria-hidden />}
                  <span>{p.text}</span>
                </div>
              ))}
              {lineIssues.map((p) => (
                <div key={p.key} className="verdict" data-tone="bad"><CircleAlert aria-hidden /><span>{p.text}</span></div>
              ))}
              {pickupId && reserved != null ? (
                <div className="verdict">
                  <Info aria-hidden />
                  <span style={{ flex: 1 }}>
                    {byVariety
                      ? coverage?.complete
                        ? `Atendés su reserva del portal de ${g(reserved)}: ${itemsLabel(reservedItems)}. Con estas filas la reserva queda cerrada.`
                        : `Atendés su reserva del portal de ${g(reserved)}. Todavía falta imputar: ${(coverage?.pending ?? []).join(", ") || "elegir el lote de cada variedad"}. La reserva sigue abierta hasta cubrirla.`
                      : `Atendés su reserva del portal de ${g(reserved)}${reservedItems.length ? `: ${itemsLabel(reservedItems)}` : ""}. Esta entrega la cierra${amount && Math.abs(amount - reserved) > 0.001 ? " (queda registrado que fue distinto de lo reservado)" : ""}.`}
                  </span>
                  {reservedItems.length ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ background: "transparent", color: "#d5e5db", borderColor: "#355a4b" }}
                      onClick={() => { setMode(byVariety ? "total" : "variedad"); setFailure(null); }}
                    >
                      {byVariety ? "Atender por total" : "Atender por variedad"}
                    </button>
                  ) : (
                    <button type="button" className="btn btn-sm" style={{ background: "transparent", color: "#d5e5db", borderColor: "#355a4b" }} onClick={() => setPickupId(null)}>No es la reserva</button>
                  )}
                </div>
              ) : null}
              {!byVariety && status && !batch ? <div className="verdict"><Info aria-hidden />Elegí el lote a entregar.</div> : null}
              {byVariety && readyVariety && !failure ? (
                <div className="verdict" data-tone="ok">
                  <CircleCheck aria-hidden />Habilitado: {g(linesTotal)} en {lines.length} {lines.length === 1 ? "variedad" : "variedades"}. El servidor lo vuelve a validar al confirmar.
                </div>
              ) : null}
              {!byVariety && ready && !failure ? (
                <div className="verdict" data-tone="ok"><CircleCheck aria-hidden />Habilitado: {g(amount)} de {batch!.strain}. El servidor lo vuelve a validar al confirmar.</div>
              ) : null}
            </div>

            <button className="btn btn-lg btn-block" style={{ marginTop: 18 }} disabled={busy || (byVariety ? !readyVariety : !ready)}>
              {busy
                ? "Registrando…"
                : byVariety
                  ? readyVariety
                    ? `Confirmar ${g(linesTotal)} en ${lines.length} ${lines.length === 1 ? "variedad" : "variedades"}`
                    : "Confirmar entrega"
                  : ready
                    ? `Confirmar entrega de ${g(amount)}`
                    : "Confirmar entrega"}
            </button>
          </ValidatedForm>
        )}
      </section>
    </div>
  );
}
