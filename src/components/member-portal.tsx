"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2, CircleAlert, QrCode } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { ReasonDialog } from "./dialog";
import { useToast } from "./toast";

type Overview = {
  member: {
    legajo: number;
    status: string;
    firstName: string;
    lastName: string;
    reprocannStatus: string;
    reprocannNumber: string | null;
    reprocannExpiresAt: string | null;
    reprocannOk: boolean;
    reprocannDays: number | null;
  };
  club: { nombre: string; aportePorGramo: number | null };
  limits: { monthLimitG: number; dayLimitG: number; isMinor: boolean; thcMaxPct: number | null };
  usage: { dayGrams: number; monthGrams: number };
  pendingGrams: number;
  disponibleMes: number;
  disponibleDia: number;
  stock: number;
  tope: number;
  topeMotivo: "mes" | "dia" | "stock";
  aporteEstimadoTope: number | null;
  pickups: { id: string; grams: number; status: string; createdAt: string; pickupLabel: string | null; aporteEstimado: number | null; cancelReason: string | null }[];
};

type Slot = { startMin: number; label: string; free: number; past: boolean; full: boolean };
type Day = { key: string; weekday: number };

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const g = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;
const WD = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const WDL = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const dayParts = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { wd: WD[wd], long: `${WDL[wd]} ${d}/${m}`, d };
};
const PICKUP_LABEL: Record<string, { label: string; tone: string }> = {
  SOLICITADA: { label: "Reservado", tone: "brand" },
  CONFIRMADA: { label: "Confirmado por el club", tone: "ok" },
  RETIRADA: { label: "Retirado", tone: "mute" },
  VENCIDA: { label: "Venció sin retirar", tone: "warn" },
  CANCELADA: { label: "Cancelado", tone: "mute" },
};

export type MemberHistory = { id: string; at: string; grams: number; strain: string; batch: string; voided: boolean }[];
const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));
const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso)) : "—";

export function MemberPortal({
  initial,
  initialSlots,
  initialDay,
  qr,
  history,
  consentDate,
}: {
  initial: Overview;
  initialSlots: Slot[];
  initialDay: string;
  qr: string;
  history: MemberHistory;
  consentDate: string | null;
}) {
  const toast = useToast();
  const [data, setData] = useState<Overview>(initial);
  const [day, setDay] = useState(initialDay);
  const [days, setDays] = useState<Day[]>([]);
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [grams, setGrams] = useState<string>("");
  const [slot, setSlot] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ slots: Slot[]; days: Day[] }>(`/api/portal/slots?date=${day}`)
      .then((d) => {
        if (!alive) return;
        setSlots(d.slots ?? []);
        setDays(d.days ?? []);
        setSlot(null);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [day]);

  const open = data.member.reprocannOk && data.member.status === "ACTIVO" && data.tope > 0;
  const gramsNum = Number(grams.replace(",", "."));
  const validGrams = Number.isFinite(gramsNum) && gramsNum > 0 && gramsNum <= data.tope + 1e-9;
  const estimated = data.club.aportePorGramo != null && validGrams ? data.club.aportePorGramo * gramsNum : null;
  const chosen = slots.find((s) => s.startMin === slot);
  const openPickup = data.pickups.find((p) => ["SOLICITADA", "CONFIRMADA"].includes(p.status));

  async function reserve(event: React.FormEvent) {
    event.preventDefault();
    if (slot == null || !validGrams) return;
    setBusy(true);
    setError(null);
    try {
      const json = await api<{ overview: Overview }>("/api/portal/pickups", { body: { grams: gramsNum, date: day, startMin: slot } });
      setData(json.overview);
      setGrams("");
      setSlot(null);
      toast({ tone: "ok", title: "Reserva tomada", text: "El club la confirma y te espera en el horario elegido." });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const limit = data.limits.monthLimitG;
  const pct = (v: number) => `${Math.min(100, (v / limit) * 100)}%`;

  return (
    <>
      <section className="allowance" aria-label="Tu saldo del mes">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div style={{ fontSize: 14, color: "#a9c0b3" }}>Hola, {data.member.firstName}. Te quedan este mes</div>
            <div className="allowance-big" style={{ marginTop: 8 }}>{String(data.disponibleMes).replace(".", ",")}<small>g</small></div>
          </div>
          <button className="rail-out" onClick={() => setShowCard((s) => !s)} aria-expanded={showCard} aria-label="Mostrar mi carnet" title="Mi carnet" style={{ padding: 8 }}>
            <QrCode size={20} />
          </button>
        </div>
        <div className="gauge-track" style={{ marginTop: 18 }} aria-hidden>
          <span className="gauge-used" style={{ width: pct(data.usage.monthGrams) }} />
          <span className="gauge-now" style={{ left: pct(data.usage.monthGrams), width: pct(data.pendingGrams) }} />
        </div>
        <div className="gauge-row" style={{ marginTop: 8, marginBottom: 0 }}>
          <span>Retiraste <b>{g(data.usage.monthGrams)}</b>{data.pendingGrams ? <>, reservaste <b>{g(data.pendingGrams)}</b></> : null}</span>
          <span>de {g(limit)}</span>
        </div>
        <div className="flex flex-wrap gap-2" style={{ marginTop: 14, fontSize: 13, color: "#a9c0b3" }}>
          <span>Legajo {data.member.legajo}</span>
          <span>·</span>
          <span style={{ color: data.member.reprocannOk ? "#a6e8bf" : "#ffb4a6" }}>
            {data.member.reprocannOk
              ? `REPROCANN vigente${data.member.reprocannDays != null ? `, vence en ${data.member.reprocannDays} días` : ""}`
              : "REPROCANN vencido"}
          </span>
          {data.limits.isMinor ? <><span>·</span><span>Tope reducido por edad{data.limits.thcMaxPct != null ? `, hasta ${data.limits.thcMaxPct}% THC` : ""}</span></> : null}
        </div>
        {showCard ? (
          <div className="flex items-center gap-4" style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #23453a" }}>
            <div className="qr-box" style={{ width: 132, height: 132, flex: "none" }} dangerouslySetInnerHTML={{ __html: qr }} role="img" aria-label="Código QR de tu carnet" />
            <div style={{ fontSize: 14 }}>
              <div style={{ color: "#fff", fontWeight: 650, fontFamily: "var(--font-display)", fontSize: 18 }}>{data.member.lastName}, {data.member.firstName}</div>
              <div style={{ color: "#a9c0b3" }}>Mostralo en el mostrador: abre tu legajo al instante.</div>
            </div>
          </div>
        ) : null}
      </section>

      {openPickup ? (
        <div className="note note-ok">
          <CalendarCheck2 aria-hidden />
          <div>
            <b>Tenés un retiro de {g(openPickup.grams)}{openPickup.pickupLabel ? ` el ${openPickup.pickupLabel.replace(" · ", " a las ")}` : ""}.</b>{" "}
            {openPickup.status === "CONFIRMADA" ? "El club ya lo confirmó." : "El club lo va a confirmar."} Traé tu DNI.
          </div>
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-head"><div>
          <h1 className="panel-title" style={{ fontSize: 19 }}>Reservar un retiro</h1>
          <p className="panel-sub">Reservás gramos de la producción del club y los retirás vos, en el club. El aporte de cultivo se abona al retirar y es un prorrateo de costos, no una venta.</p>
        </div></div>
        <div className="panel-body">
          {!open ? (
            <div className="note note-warn">
              <CircleAlert aria-hidden />
              <div>
                {!data.member.reprocannOk
                  ? "Tu REPROCANN está vencido: el club no puede reservarte un retiro hasta que lo renueves. Avisá en la secretaría cuando lo tengas."
                  : data.member.status !== "ACTIVO"
                    ? "Tu ficha no está activa. Hablá con la secretaría del club."
                    : data.topeMotivo === "stock"
                      ? "En este momento no hay stock para reservar. Probá en unos días."
                      : "Ya usaste todo tu saldo disponible. Se renueva el mes que viene."}
              </div>
            </div>
          ) : (
            <form className="stack" style={{ gap: 18 }} onSubmit={reserve}>
              <div>
                <label className="label" htmlFor="p-grams">¿Cuántos gramos?</label>
                <div className="flex flex-wrap items-center gap-2">
                  <div style={{ position: "relative", width: 130 }}>
                    <input id="p-grams" className="input tnum" inputMode="decimal" placeholder="0" value={grams} onChange={(e) => setGrams(e.target.value.replace(/[^\d.,]/g, ""))} style={{ fontSize: 20, fontWeight: 650, paddingRight: 30 }} aria-describedby="p-grams-hint" />
                    <span style={{ position: "absolute", right: 12, top: 10, color: "var(--muted)", fontWeight: 600 }}>g</span>
                  </div>
                  {[5, 10].filter((v) => v < data.tope).map((v) => (
                    <button key={v} type="button" className="btn btn-sm btn-quiet" onClick={() => setGrams(String(v))}>{v} g</button>
                  ))}
                  <button type="button" className="btn btn-sm btn-quiet" onClick={() => setGrams(String(data.tope))}>Todo ({g(data.tope)})</button>
                </div>
                <span className="hint" id="p-grams-hint">
                  Hasta {g(data.tope)}{" "}
                  {data.topeMotivo === "dia" ? `por el tope diario de ${g(data.limits.dayLimitG)}` : data.topeMotivo === "mes" ? "de tu saldo del mes" : "según el stock del club"}.
                  {estimated != null ? ` Aporte estimado: ${MONEY.format(estimated)}.` : data.club.aportePorGramo != null ? ` Aporte: ${MONEY.format(data.club.aportePorGramo)} por gramo.` : ""}
                </span>
              </div>

              <div>
                <span className="label">¿Qué día?</span>
                <div className="days" role="radiogroup" aria-label="Día del retiro">
                  {(days.length ? days : [{ key: initialDay, weekday: 0 }]).map((d) => {
                    const p = dayParts(d.key);
                    return (
                      <button key={d.key} type="button" className="day" aria-pressed={d.key === day} onClick={() => setDay(d.key)}>
                        <small>{p.wd}</small><b className="tnum">{p.d}</b>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="label">¿A qué hora?</span>
                {slots.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>Ese día el club no atiende.</p>
                ) : (
                  <div className="slot-grid" role="radiogroup" aria-label="Horario del retiro">
                    {slots.map((s) => (
                      <button key={s.startMin} type="button" className="slot" disabled={s.full || s.past} aria-pressed={s.startMin === slot} onClick={() => setSlot(s.startMin)}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error ? <div className="note note-danger" role="alert">{error}</div> : null}
              <button className="btn btn-lg btn-block" disabled={busy || !validGrams || slot == null}>
                {busy ? "Reservando…" : validGrams && chosen ? `Reservar ${g(gramsNum)} el ${dayParts(day).long} a las ${chosen.label}` : "Reservar retiro"}
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div>
          <h2 className="panel-title">Tus reservas</h2>
          <p className="panel-sub">Al retirar, el club vuelve a verificar tu REPROCANN y tus topes.</p>
        </div></div>
        {data.pickups.length === 0 ? (
          <div className="empty">Todavía no reservaste ningún retiro.</div>
        ) : (
          <ul className="rows">
            {data.pickups.map((p) => {
              const st = PICKUP_LABEL[p.status] ?? { label: p.status, tone: "mute" };
              const isOpen = ["SOLICITADA", "CONFIRMADA"].includes(p.status);
              return (
                <li key={p.id}>
                  <div className="grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <b className="tnum">{g(p.grams)}</b>
                      <span className={st.tone === "mute" ? "chip" : `chip chip-${st.tone}`}>{st.label}</span>
                    </div>
                    <div className="cell-meta">
                      {p.pickupLabel ?? "sin horario"}
                      {p.aporteEstimado != null ? ` · aporte ${p.status === "RETIRADA" ? "" : "estimado "}${MONEY.format(p.aporteEstimado)}` : ""}
                      {p.cancelReason ? ` · ${p.cancelReason}` : ""}
                    </div>
                  </div>
                  {isOpen ? <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setCancelId(p.id)}>Cancelar</button> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel-head"><div>
          <h2 className="panel-title">Lo que retiraste</h2>
          <p className="panel-sub">Tus últimas entregas en el club. Si una figura anulada, el club la corrigió y no cuenta para tu tope.</p>
        </div></div>
        {history.length === 0 ? (
          <div className="empty">Todavía no retiraste nada.</div>
        ) : (
          <ul className="rows">
            {history.map((h) => (
              <li key={h.id} className={h.voided ? "voided" : undefined}>
                <div className="grow">
                  <div className="cell-main" style={h.voided ? { textDecoration: "line-through", color: "var(--muted)" } : undefined}>{h.strain}</div>
                  <div className="cell-meta">{fmtDay(h.at)} · lote {h.batch}{h.voided ? " · anulada" : ""}</div>
                </div>
                <b className="tnum">{g(h.grams)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" id="documentacion">
        <div className="panel-head"><div>
          <h2 className="panel-title">Tu documentación</h2>
          <p className="panel-sub">Si algo no coincide con tus papeles, avisá en la secretaría: el club lo corrige en tu legajo.</p>
        </div></div>
        <div className="panel-body">
          <dl className="dl">
            <dt>Legajo</dt><dd className="tnum">{data.member.legajo}</dd>
            <dt>REPROCANN</dt><dd>{data.member.reprocannNumber ?? "Sin número cargado"}</dd>
            <dt>Vence</dt><dd>{fmtDate(data.member.reprocannExpiresAt)}</dd>
            <dt>Consentimiento</dt><dd>{consentDate ? `Firmado el ${fmtDate(consentDate)}` : "Falta firmar en el club"}</dd>
          </dl>
        </div>
      </section>

      <ReasonDialog
        open={cancelId != null}
        onClose={() => setCancelId(null)}
        title="Cancelar la reserva"
        description="Los gramos vuelven a tu saldo del mes y el horario se libera."
        confirmLabel="Cancelar reserva"
        reasonLabel="¿Querés contarle al club por qué? (opcional)"
        reasonRequired={false}
        danger
        busy={busy}
        onConfirm={async (reason) => {
          if (!cancelId) return;
          setBusy(true);
          try {
            const json = await api<{ overview: Overview }>(`/api/portal/pickups/${cancelId}/cancel`, { body: { reason: reason || undefined } });
            setData(json.overview);
            setCancelId(null);
            toast({ tone: "ok", title: "Reserva cancelada" });
          } catch (err) {
            toast({ tone: "bad", title: "No se pudo cancelar", text: errMsg(err) });
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
