"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { REPROCANN_STATUS, MEMBER_STATUS } from "@/lib/labels";
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
  club: { nombre: string; aportePorGramo: number | null; timezone?: string };
  limits: { monthLimitG: number; dayLimitG: number; isMinor: boolean; thcMaxPct: number | null };
  usage: { dayGrams: number; monthGrams: number };
  pendingGrams: number;
  disponibleMes: number;
  disponibleDia: number;
  stock: number;
  tope: number;
  topeMotivo: "mes" | "dia" | "stock";
  aporteEstimadoTope: number | null;
  pickups: {
    id: string;
    grams: number;
    status: string;
    createdAt: string;
    pickupLabel: string | null;
    pickupAt?: string | null;
    aporteEstimado: number | null;
    cancelReason: string | null;
  }[];
};

type Slot = { startMin: number; label: string; free: number; past: boolean; full: boolean };
type Day = { key: string; weekday: number };
export type MemberHistory = { id: string; at: string; grams: number; strain: string; batch: string; voided: boolean }[];
const gramsLabel = (n: number) => `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n)} g`;
const money = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(n);
const dateLabel = (value: string) => new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
const dayLabel = (value: string) => new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
const pickupLabel: Record<string, string> = { SOLICITADA: "Pendiente de confirmación", CONFIRMADA: "Confirmado por el club", RETIRADA: "Retirado", VENCIDA: "Solicitud vencida", CANCELADA: "Cancelado" };
const isOpen = (status: string) => ["SOLICITADA", "CONFIRMADA"].includes(status);

async function request(url: string, body?: unknown) {
  const response = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status === 401 ? "Tu sesión venció. Volvé a ingresar al portal." : result.message ?? "No pudimos conectar con el club. Volvé a intentar.");
  return result;
}

export function MemberPortal({ initial, initialSlots, initialDay, history, consentDate }: { initial: Overview; initialSlots: Slot[]; initialDay: string; history: MemberHistory; consentDate: string | null }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [day, setDay] = useState(initialDay);
  const [days, setDays] = useState<Day[]>([]);
  const [availability, setAvailability] = useState<{ day: string; slots: Slot[]; error: string | null; loading: boolean }>({ day: initialDay, slots: initialSlots, error: null, loading: true });
  const [refresh, setRefresh] = useState(0);
  const [amount, setAmount] = useState("");
  const [slot, setSlot] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [review, setReview] = useState(false);

  useEffect(() => {
    let active = true;
    request(`/api/portal/slots?date=${day}`).then(result => {
      if (!active) return;
      setAvailability({ day, slots: result.slots, error: null, loading: false });
      setDays(result.days);
    }).catch(error => {
      if (active) setAvailability({ day, slots: [], error: error.message, loading: false });
    });
    return () => { active = false; };
  }, [day, refresh]);

  const pending = data.pickups.filter(p => isOpen(p.status));
  const next = [...pending].sort((a, b) => {
    const time = (p: typeof a) => p.pickupAt ?? p.createdAt;
    return time(a).localeCompare(time(b));
  })[0];
  const loadingSlots = availability.loading || availability.day !== day;
  const slots = loadingSlots ? [] : availability.slots.filter(s => !s.past && !s.full);
  const selected = slots.find(s => s.startMin === slot);
  const grams = Number(amount.replace(",", "."));
  const valid = Number.isFinite(grams) && grams > 0 && grams <= data.tope && Math.abs(grams * 100 - Math.round(grams * 100)) < 1e-6;
  const enabled = data.member.status === "ACTIVO" && data.member.reprocannOk && data.tope > 0;
  const estimate = data.club.aportePorGramo != null && valid ? money(data.club.aportePorGramo * grams) : "A confirmar en el club";
  const blockedReason = data.member.status !== "ACTIVO" ? "Tu ficha necesita revisión. Consultá a la secretaría del club."
    : !data.member.reprocannOk ? "Necesitamos revisar tu REPROCANN antes de tomar una solicitud. Consultá la sección Documentación."
    : data.topeMotivo === "mes" ? "Tu cupo mensual está utilizado o comprometido en solicitudes pendientes."
    : data.topeMotivo === "dia" ? "Alcanzaste la disponibilidad calculada para hoy. Consultá al club para coordinar otro día."
    : "Por ahora no hay stock disponible para nuevas solicitudes.";
  const pct = Math.max(0, Math.min(100, (data.usage.monthGrams + data.pendingGrams) / data.limits.monthLimitG * 100));

  function reloadSlots() {
    setSlot(null); setReview(false);
    setAvailability(a => ({ ...a, loading: true })); setRefresh(v => v + 1);
  }
  async function refreshAccount() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setMessage(null);
    try {
      setData(await request("/api/portal/overview")); reloadSlots(); router.refresh();
      setMessage({ error: false, text: "Tu información está actualizada." });
    } catch (error) { setMessage({ error: true, text: (error as Error).message }); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function reserve() {
    if (submitting.current || !enabled || !valid || !selected || loadingSlots) return;
    submitting.current = true; setBusy(true); setMessage(null);
    try {
      const result = await request("/api/portal/pickups", { grams, date: day, startMin: slot });
      setData(result.overview); setAmount(""); setReview(false); reloadSlots();
      setMessage({ error: false, text: "Solicitud enviada. Podés seguir su confirmación en Próximo retiro." }); router.refresh();
    } catch (error) {
      setMessage({ error: true, text: `${(error as Error).message} Si se interrumpió la conexión, actualizá tus reservas antes de volver a enviar.` });
    } finally { submitting.current = false; setBusy(false); }
  }
  async function cancel(event: React.FormEvent) {
    event.preventDefault(); if (submitting.current || !cancelId || !reason.trim()) return;
    submitting.current = true; setBusy(true); setMessage(null);
    try {
      const result = await request(`/api/portal/pickups/${cancelId}/cancel`, { reason: reason.trim() });
      setData(result.overview); setCancelId(null); setReason(""); reloadSlots(); router.refresh();
      setMessage({ error: false, text: "Solicitud cancelada. La disponibilidad se actualizó." });
    } catch (error) { setMessage({ error: true, text: (error as Error).message }); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <div className="member-home">
    <section className="member-welcome" id="inicio">
      <div><p className="member-eyebrow">TU ESPACIO EN EL CLUB</p><h1>Hola, {data.member.firstName}<span>.</span></h1><p>Tu próximo encuentro, todo en un lugar.</p></div>
      <a className="member-pass" href="#documentacion"><span className="member-avatar" aria-hidden="true">{data.member.firstName.slice(0, 1)}{data.member.lastName.slice(0, 1)}</span><span><small>MI LEGAJO</small><strong>#{String(data.member.legajo).padStart(4, "0")}</strong></span><span aria-hidden="true">↗</span></a>
    </section>
    <nav className="member-tabs" aria-label="Secciones del portal"><a href="#proximo">Próximo retiro</a><a href="#reservar">Solicitar</a><a href="#actividad">Actividad</a><a href="#documentacion">Documentación</a></nav>
    {message && <div className={`alert ${message.error ? "alert-danger" : "alert-ok"}`} role={message.error ? "alert" : "status"}>{message.text}</div>}
    <div className="member-overview-grid">
      <section id="proximo" className="member-next">
        <div className="member-eyebrow">{next ? "TU PRÓXIMO RETIRO" : "NOS VEMOS EN EL CLUB"}<span aria-hidden="true">◷</span></div>
        <h2>{next ? next.pickupLabel ?? "Horario a coordinar" : "Tu próxima visita empieza acá"}</h2>
        <p>{next ? `${gramsLabel(next.grams)} solicitados · ${pickupLabel[next.status]}` : "Elegí la cantidad y un horario. El equipo del club revisará tu solicitud."}</p>
        {next ? <><div className="member-steps"><span className="done">1 · Solicitado</span><span className={next.status === "CONFIRMADA" ? "done" : ""}>2 · Confirmado</span><span>3 · Retiro</span></div><p className="member-next-note">Llevá tu documento y REPROCANN. La habilitación se vuelve a verificar al retirar.</p><a href="#actividad" className="member-light-button">Ver mis solicitudes →</a></> : <a href="#reservar" className="member-light-button">Planificar un retiro →</a>}
      </section>
      <section className="member-card member-quota"><p className="member-eyebrow">TU MES, A SIMPLE VISTA</p><div className="member-quota-value">{gramsLabel(data.disponibleMes)}<span>de cupo restante</span></div><div className="meter" role="meter" aria-label="Cupo mensual disponible" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(100 - pct)}><span style={{ width: `${Math.round(100 - pct)}%` }} /></div><dl className="member-facts"><div><dt>Retirado</dt><dd>{gramsLabel(data.usage.monthGrams)}</dd></div><div><dt>Solicitado</dt><dd>{gramsLabel(data.pendingGrams)}</dd></div><div><dt>Tope mensual</dt><dd>{gramsLabel(data.limits.monthLimitG)}</dd></div></dl><p className="cell-meta">El cupo restante no garantiza stock ni confirma un retiro.</p></section>
    </div>
    <div className="member-content-grid">
      <section id="reservar" className="member-card">
        <p className="member-eyebrow">PLANIFICÁ TU VISITA</p><h2>Solicitar un retiro</h2><p className="member-description">Elegí un horario que te quede cómodo. El club confirma la solicitud y revisa la disponibilidad.</p>
        {!enabled ? <p className="alert alert-warn mt-4">{blockedReason}</p> : <form onSubmit={e => { e.preventDefault(); if (valid && selected) setReview(true); }}>
          <fieldset disabled={busy}>
            <div className="member-form-row"><label className="label" htmlFor="portal-grams">01 · Cantidad en gramos<input id="portal-grams" className="input" inputMode="decimal" autoComplete="off" placeholder="Ej. 5" value={amount} onChange={e => { setAmount(e.target.value); setReview(false); }} aria-describedby="portal-amount-help" /></label><label className="label" htmlFor="portal-day">02 · Día de retiro<select id="portal-day" className="select" value={day} onChange={e => { setDay(e.target.value); setSlot(null); setReview(false); }}>{(days.length ? days : [{ key: initialDay }]).map(d => <option value={d.key} key={d.key}>{dayLabel(d.key)}</option>)}</select></label></div>
            <p id="portal-amount-help" className="cell-meta">Podés solicitar hasta {gramsLabel(data.tope)} ahora ({data.topeMotivo === "dia" ? "tope diario" : data.topeMotivo === "mes" ? "cupo del mes" : "stock disponible"}). Máximo dos decimales.{amount && !valid ? " Revisá la cantidad ingresada." : ""}</p>
            <div className="member-slot-heading"><h3>03 · Elegí un horario</h3><span>Hora del club</span></div>
            {loadingSlots ? <p role="status" className="member-empty">Consultando horarios…</p> : availability.error ? <div className="alert alert-warn" role="alert">{availability.error}<button className="btn btn-secondary mt-2" type="button" onClick={reloadSlots}>Reintentar horarios</button></div> : slots.length ? <div className="member-slots" role="group" aria-label="Horarios disponibles">{slots.map(s => <button key={s.startMin} type="button" aria-pressed={slot === s.startMin} onClick={() => { setSlot(s.startMin); setReview(false); }}>{s.label}</button>)}</div> : <p className="member-empty">No quedan horarios disponibles para este día. Elegí otra fecha.</p>}
            <div className="member-estimate"><span>Aporte de cultivo estimado<strong>{estimate}</strong></span><small>Se coordina al retirar.<br />No estás haciendo un pago online.</small></div>
            {review && selected ? <div className="member-review" role="region" aria-label="Revisar solicitud"><h3>Revisá tu solicitud</h3><p>{gramsLabel(grams)} · {dayLabel(day)} · {selected.label}</p><p className="cell-meta">Quedará pendiente de confirmación. La reserva no habilita por sí sola la entrega.</p><div className="flex flex-wrap gap-2 mt-3"><button className="btn" type="button" disabled={busy} onClick={reserve}>{busy ? "Enviando…" : "Enviar solicitud"}</button><button className="btn btn-secondary" type="button" onClick={() => setReview(false)}>Volver a editar</button></div></div> : <button className="btn member-submit" disabled={busy || !valid || !selected || loadingSlots}>Revisar solicitud →</button>}
          </fieldset>
        </form>}
      </section>
      <aside id="documentacion" className="member-card member-docs"><p className="member-eyebrow">TU DOCUMENTACIÓN</p><h2>Mi legajo</h2><p className="member-description">Tu legajo y los datos que el club verifica antes de cada retiro.</p><dl><div><dt>Estado de tu ficha</dt><dd>{MEMBER_STATUS[data.member.status]?.label ?? "A revisar"}</dd></div><div><dt>REPROCANN</dt><dd>{REPROCANN_STATUS[data.member.reprocannStatus]?.label ?? "A revisar"}</dd><dd className="cell-meta">{data.member.reprocannNumber ?? "Número pendiente de cargar"}</dd></div><div><dt>Vencimiento registrado</dt><dd>{data.member.reprocannExpiresAt ? dateLabel(data.member.reprocannExpiresAt) : "Pendiente de cargar"}</dd></div><div><dt>Consentimiento</dt><dd>{consentDate ? `Registrado el ${dateLabel(consentDate)}` : "Pendiente de registrar"}</dd></div></dl>
        {(!data.member.reprocannOk || data.member.reprocannDays != null && data.member.reprocannDays <= 30 || !data.member.reprocannExpiresAt) && <p className="alert alert-warn">{data.member.reprocannDays != null && data.member.reprocannDays >= 0 && data.member.reprocannOk ? "Tu vencimiento está cerca. Coordiná la actualización con el club." : "Consultá al club para revisar o completar tu documentación."}</p>}
        <div className="member-help"><h3>¿Cambió algún dato?</h3><p>Pedile a la secretaría que actualice tu legajo. Este portal muestra la información registrada por el club.</p></div>
      </aside>
    </div>
    <section id="actividad" className="member-card"><p className="member-eyebrow">TU ACTIVIDAD</p><div className="flex items-center justify-between gap-3"><h2>Mis solicitudes</h2><button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={refreshAccount}>Actualizar</button></div><p className="member-description">Últimas {data.pickups.length} solicitudes. Los retiros efectivos se muestran por separado.</p>
      {data.pickups.length ? <ul className="member-activity">{data.pickups.map(p => <li key={p.id}><div className="member-activity-icon" aria-hidden="true">◷</div><div className="member-activity-detail"><strong>{p.pickupLabel ?? "Horario a coordinar"}</strong><span>{gramsLabel(p.grams)}{p.aporteEstimado != null ? ` · ${money(p.aporteEstimado)} estimados` : ""}</span>{p.cancelReason && <small>{p.cancelReason}</small>}</div><span className={`chip ${p.status === "CONFIRMADA" ? "chip-ok" : isOpen(p.status) ? "chip-warn" : ""}`}>{pickupLabel[p.status] ?? p.status}</span>{isOpen(p.status) && <button type="button" className="member-text-button" disabled={busy} onClick={() => { setCancelId(p.id); setReason(""); }}>Cancelar<span className="sr-only"> solicitud de {p.pickupLabel ?? p.createdAt}</span></button>}{cancelId === p.id && <form className="member-cancel" onSubmit={cancel}><label className="label">Motivo de cancelación<textarea className="textarea" value={reason} onChange={e => setReason(e.target.value)} required maxLength={300} disabled={busy} /></label><div className="flex gap-2"><button className="btn btn-danger" disabled={busy || !reason.trim()}>Confirmar cancelación</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setCancelId(null)}>Conservar solicitud</button></div></form>}</li>)}</ul> : <p className="member-empty">Todavía no tenés solicitudes. Cuando planifiques una visita, aparecerá acá.</p>}
      <h3 className="member-history-title">Últimas entregas registradas</h3>{history.length ? <ul className="member-activity">{history.map(h => <li key={h.id}><div className="member-activity-icon" aria-hidden="true">↙</div><div className="member-activity-detail"><strong>{h.strain} · {gramsLabel(h.grams)}</strong><span>{new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: data.club.timezone ?? "America/Argentina/Buenos_Aires" }).format(new Date(h.at))} · Lote {h.batch}</span></div><span className={`chip ${h.voided ? "" : "chip-ok"}`}>{h.voided ? "Anulada" : "Entregada"}</span></li>)}</ul> : <p className="member-empty">Todavía no hay entregas registradas en tu legajo.</p>}
    </section><footer className="member-footer">Tu información es personal. Cerrá la sesión si usás un dispositivo compartido.</footer>
  </div>;
}
