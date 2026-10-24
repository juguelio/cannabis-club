"use client";

import { useEffect, useState } from "react";

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
  pickups: {
    id: string;
    grams: number;
    status: string;
    createdAt: string;
    pickupLabel: string | null;
    aporteEstimado: number | null;
    cancelReason: string | null;
  }[];
};

type Slot = { startMin: number; label: string; free: number; past: boolean; full: boolean };
type Day = { key: string; weekday: number };

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const g = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;
const DAY_LABEL = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const names = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  return `${names[date.getUTCDay()]} ${d}/${m}`;
};
const PICKUP_LABEL: Record<string, string> = {
  SOLICITADA: "Reservado",
  CONFIRMADA: "Confirmado por el club",
  RETIRADA: "Retirado",
  VENCIDA: "Venció sin retirar",
  CANCELADA: "Cancelado",
};

export function MemberPortal({ initial, initialSlots, initialDay }: { initial: Overview; initialSlots: Slot[]; initialDay: string }) {
  const [data, setData] = useState<Overview>(initial);
  const [day, setDay] = useState(initialDay);
  const [days, setDays] = useState<Day[]>([]);
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [grams, setGrams] = useState<string>("");
  const [slot, setSlot] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/portal/slots?date=${day}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setSlots(d.slots ?? []);
        setDays(d.days ?? []);
        setSlot(null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [day]);

  const open = data.member.reprocannOk && data.member.status === "ACTIVO" && data.tope > 0;
  const gramsNum = Number(grams.replace(",", "."));
  const validGrams = Number.isFinite(gramsNum) && gramsNum > 0 && gramsNum <= data.tope;
  const estimated = data.club.aportePorGramo != null && validGrams ? data.club.aportePorGramo * gramsNum : null;

  async function reserve(event: React.FormEvent) {
    event.preventDefault();
    if (slot == null) {
      setMsg({ tone: "bad", text: "Elegí un horario para retirar." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/portal/pickups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grams: gramsNum, date: day, startMin: slot }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "No se pudo reservar");
      setData(json.overview);
      setGrams("");
      setSlot(null);
      setMsg({ tone: "ok", text: "Reserva tomada. El club la confirma y te espera en el horario elegido." });
    } catch (error) {
      setMsg({ tone: "bad", text: error instanceof Error ? error.message : "Error al reservar" });
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    const reason = window.prompt("¿Por qué cancelás la reserva?");
    if (reason == null) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/portal/pickups/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "No se pudo cancelar");
      setData(json.overview);
      setMsg({ tone: "ok", text: "Reserva cancelada." });
    } catch (error) {
      setMsg({ tone: "bad", text: error instanceof Error ? error.message : "Error al cancelar" });
    } finally {
      setBusy(false);
    }
  }

  const monthPct = Math.min(100, Math.round(((data.usage.monthGrams + data.pendingGrams) / data.limits.monthLimitG) * 100));

  return (
    <div className="grid gap-4">
      <section className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title">Hola, {data.member.firstName}</h1>
            <p className="page-sub">
              Legajo {data.member.legajo} · {data.club.nombre}
            </p>
          </div>
          <span className={`chip ${data.member.reprocannOk ? "chip-ok" : "chip-danger"}`}>
            {data.member.reprocannOk
              ? `REPROCANN vigente${data.member.reprocannDays != null ? ` · ${data.member.reprocannDays} días` : ""}`
              : "REPROCANN vencido"}
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[12.5px]">
            <span>Tu mes</span>
            <span className="tnum">
              {g(data.usage.monthGrams)} retirados + {g(data.pendingGrams)} reservados de {g(data.limits.monthLimitG)}
            </span>
          </div>
          <div className="meter mt-1">
            <span style={{ width: `${monthPct}%`, background: monthPct >= 100 ? "#dc2626" : monthPct >= 80 ? "#d97706" : "var(--brand)" }} />
          </div>
          <p className="cell-meta mt-2">
            Te quedan <strong>{g(data.disponibleMes)}</strong> este mes. Tope diario: {g(data.limits.dayLimitG)}.
            {data.limits.isMinor ? ` Por tu edad, el tope es ${g(data.limits.monthLimitG)} y ≤${data.limits.thcMaxPct}% THC.` : ""}
          </p>
        </div>
      </section>

      {msg ? <div className={`alert ${msg.tone === "ok" ? "alert-ok" : "alert-warn"}`}>{msg.text}</div> : null}

      <section className="card card-pad">
        <h2 className="section-title">Reservar un retiro</h2>
        <p className="section-sub">
          Reservás gramos de la producción del club y los retirás vos, en el club. El aporte de cultivo se abona al
          retirar y se calcula por prorrateo de costos: no es una venta.
        </p>

        {!open ? (
          <div className="alert alert-warn mt-3">
            {!data.member.reprocannOk
              ? "Tu REPROCANN está vencido: el club no puede reservarte un retiro hasta que lo actualices."
              : data.member.status !== "ACTIVO"
                ? "Tu ficha no está activa. Hablá con la secretaría del club."
                : "En este momento no hay stock disponible para reservar."}
          </div>
        ) : (
          <form className="grid gap-3 mt-3" onSubmit={reserve}>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              <div>
                <label className="label">Gramos</label>
                <input
                  className="input tnum"
                  inputMode="decimal"
                  placeholder={`Ej.: ${Math.min(10, data.tope)}`}
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Día</label>
                <select className="select" value={day} onChange={(e) => setDay(e.target.value)}>
                  {(days.length ? days : [{ key: initialDay, weekday: 0 }]).map((d) => (
                    <option key={d.key} value={d.key}>
                      {DAY_LABEL(d.key)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Horario</label>
                <select className="select" value={slot ?? ""} onChange={(e) => setSlot(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Elegir…</option>
                  {slots.map((s) => (
                    <option key={s.startMin} value={s.startMin} disabled={s.full || s.past}>
                      {s.label} {s.past ? "(ya pasó)" : s.full ? "(completo)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {data.tope === 0 ? (
              <p className="cell-meta">No te queda saldo disponible este mes.</p>
            ) : (
              <p className="cell-meta">
                Podés reservar hasta <strong>{g(data.tope)}</strong>{" "}
                {data.topeMotivo === "dia"
                  ? `porque el tope diario es ${g(data.limits.dayLimitG)} y ya retiraste ${g(data.usage.dayGrams)} hoy`
                  : data.topeMotivo === "mes"
                    ? `porque te quedan ${g(data.disponibleMes)} de tu tope mensual`
                    : "según el stock disponible en el club"}
                {estimated != null ? ` · aporte estimado ${MONEY.format(estimated)}` : ""}
              </p>
            )}

            <button className="btn" disabled={busy || !validGrams || slot == null}>
              {busy ? "Reservando…" : "Reservar retiro"}
            </button>
            {!validGrams || slot == null ? (
              <p className="cell-meta">
                {slot == null ? "Elegí el horario del retiro. " : ""}
                {!validGrams ? `Indicá cuántos gramos (hasta ${g(data.tope)}).` : ""}
              </p>
            ) : null}
          </form>
        )}
      </section>

      <section className="card">
        <div className="px-4 pt-4 pb-2">
          <h2 className="section-title">Tus reservas</h2>
          <p className="section-sub">La reserva no habilita la entrega: el club valida REPROCANN y topes al retirar.</p>
        </div>
        {data.pickups.length === 0 ? (
          <div className="empty">Todavía no reservaste ningún retiro.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th className="num">Gramos</th>
                  <th>Estado</th>
                  <th>Aporte de cultivo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.pickups.map((p) => (
                  <tr key={p.id}>
                    <td>{p.pickupLabel ?? "sin horario"}</td>
                    <td className="num tnum">{g(p.grams)}</td>
                    <td>
                      <span
                        className={`chip ${
                          p.status === "RETIRADA" ? "chip-ok" : p.status === "CANCELADA" || p.status === "VENCIDA" ? "chip-danger" : "chip-brand"
                        }`}
                      >
                        {PICKUP_LABEL[p.status] ?? p.status}
                      </span>
                      {p.cancelReason ? <div className="cell-meta">{p.cancelReason}</div> : null}
                    </td>
                    <td className="tnum">
                      {p.aporteEstimado != null ? (
                        <>
                          {MONEY.format(p.aporteEstimado)}
                          {p.status === "RETIRADA" ? null : <span className="cell-meta"> estimado</span>}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {["SOLICITADA", "CONFIRMADA"].includes(p.status) ? (
                        <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => cancel(p.id)}>
                          Cancelar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
