"use client";

import { useState } from "react";
import Link from "next/link";
import { Chip, Empty, Section } from "@/components/ui";
import { APPOINTMENT_CHANNEL, APPOINTMENT_STATUS, WEEKDAYS } from "@/lib/labels";
import type { DayBoard } from "@/lib/appointments-db";

type MemberOption = { id: string; legajo: number; name: string };

const fmtDay = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return { long: `${WEEKDAYS[date.getUTCDay()]} ${d}/${m}`, short: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}` };
};

const shift = (key: string, delta: number) => {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
};

export function AppointmentsBoard({
  initial,
  today,
  members,
}: {
  initial: DayBoard;
  today: string;
  members: MemberOption[];
}) {
  const [board, setBoard] = useState<DayBoard>(initial);
  const [slot, setSlot] = useState<number | null>(null);
  const [memberId, setMemberId] = useState("");
  const [channel, setChannel] = useState("MOSTRADOR");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  async function load(day: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/appointments?date=${day}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "No pude cargar los turnos");
      setBoard(data);
      setSlot(null);
    } catch (error) {
      setMsg({ tone: "bad", text: error instanceof Error ? error.message : "Error al cargar" });
    } finally {
      setBusy(false);
    }
  }

  async function reserve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (slot == null) {
      setMsg({ tone: "bad", text: "Elegí un horario de la grilla." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, date: board.day, startMin: slot, channel, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "No se pudo reservar");
      setBoard(data.board);
      setMsg({ tone: "ok", text: `Turno reservado: ${data.appointment.member.lastName} a las ${data.board.slots.find((s: { startMin: number }) => s.startMin === slot)?.label ?? ""}.` });
      setNotes("");
      setSlot(null);
    } catch (error) {
      setMsg({ tone: "bad", text: error instanceof Error ? error.message : "Error al reservar" });
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string, reason?: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/appointments/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "No se pudo actualizar el turno");
      setBoard(data.board);
    } catch (error) {
      setMsg({ tone: "bad", text: error instanceof Error ? error.message : "Error al actualizar" });
    } finally {
      setBusy(false);
    }
  }

  function cancel(id: string) {
    const reason = window.prompt("Motivo de la cancelación (queda en el registro):");
    if (reason == null) return;
    if (!reason.trim()) {
      setMsg({ tone: "bad", text: "La cancelación necesita un motivo." });
      return;
    }
    void setStatus(id, "CANCELADO", reason.trim());
  }

  const day = fmtDay(board.day);
  const libres = board.slots.reduce((a, s) => a + s.free, 0);
  const chosen = board.slots.find((s) => s.startMin === slot);

  return (
    <>
      <div className="card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn" onClick={() => load(shift(board.day, -1))} disabled={busy} aria-label="Día anterior">
            ‹
          </button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{day.long}</div>
            <div className="cell-meta tnum">
              {board.day === today ? "hoy" : "otro día"} · {board.summary.total} turno{board.summary.total === 1 ? "" : "s"} ·{" "}
              {libres} cupo{libres === 1 ? "" : "s"} libre{libres === 1 ? "" : "s"}
            </div>
          </div>
          <button className="btn" onClick={() => load(shift(board.day, 1))} disabled={busy} aria-label="Día siguiente">
            ›
          </button>
          <button className="btn" onClick={() => load(today)} disabled={busy || board.day === today}>
            Hoy
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="brand">Por llegar {board.summary.porLlegar}</Chip>
          <Chip tone="ok">Atendidos {board.summary.atendidos}</Chip>
          <Chip tone={board.summary.ausentes ? "warn" : "mute"}>No vinieron {board.summary.ausentes}</Chip>
          {board.summary.cancelados ? <Chip tone="mute">Cancelados {board.summary.cancelados}</Chip> : null}
        </div>
      </div>

      {msg ? (
        <div className={`alert ${msg.tone === "ok" ? "alert-ok" : "alert-warn"} mt-3`}>{msg.text}</div>
      ) : null}

      <div className="dashboard-grid">
        <Section
          title="Franjas del día"
          subtitle={
            board.slots.length
              ? "Elegí un horario libre y después el socio. El cupo es por turno, no por día."
              : "No hay franjas configuradas para este día."
          }
        >
          {board.slots.length === 0 ? (
            <Empty>
              Este día no abre el dispensario.{" "}
              {board.openingHours.length ? `Atiende: ${board.openingHours.map((h) => h.label).join(" · ")}.` : "Falta configurar franjas."}
            </Empty>
          ) : (
            <div className="grid gap-2 px-4 pb-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}>
              {board.slots.map((s) => {
                const selected = s.startMin === slot;
                const disabled = s.full || s.past;
                return (
                  <button
                    key={s.at}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSlot(s.startMin)}
                    className="card px-3 py-2 text-left"
                    data-selected={selected}
                    style={{
                      opacity: disabled ? 0.55 : 1,
                      borderColor: selected ? "var(--brand)" : undefined,
                      boxShadow: selected ? "0 0 0 1px var(--brand) inset" : undefined,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    <div
                      className="tnum"
                      style={{ fontWeight: 700, fontSize: 15, textDecoration: disabled ? "line-through" : "none" }}
                    >
                      {selected ? "✓ " : ""}
                      {s.label}
                    </div>
                    <div className="cell-meta tnum">
                      {s.taken}/{s.capacity} {s.past ? "· ya pasó" : s.full ? "· completo" : `· ${s.free} libre${s.free === 1 ? "" : "s"}`}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Reservar turno" subtitle={chosen ? `Horario elegido: ${chosen.label}` : "Primero elegí un horario de la grilla"}>
          <form className="px-4 pb-4 grid gap-3" onSubmit={reserve}>
            <div>
              <label className="label">Horario</label>
              <select
                className="select"
                value={slot ?? ""}
                onChange={(e) => setSlot(e.target.value === "" ? null : Number(e.target.value))}
                required
              >
                <option value="">Elegir horario…</option>
                {board.slots.map((s) => (
                  <option key={s.at} value={s.startMin} disabled={s.full || s.past}>
                    {s.label} · {s.full ? "completo" : s.past ? "ya pasó" : `${s.free} libre${s.free === 1 ? "" : "s"}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Socio</label>
              <select className="select" value={memberId} onChange={(e) => setMemberId(e.target.value)} required>
                <option value="">Elegir socio…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.legajo} · {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Canal del pedido</label>
              <select className="select" value={channel} onChange={(e) => setChannel(e.target.value)}>
                {Object.entries(APPOINTMENT_CHANNEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Nota (opcional)</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: viene con su hijo, prefiere la mañana" />
            </div>
            <button className="btn btn-primary" disabled={busy || !memberId || slot == null}>
              {busy ? "Guardando…" : "Reservar turno"}
            </button>
          </form>
        </Section>
      </div>

      <div className="mt-4">
        <Section title="Turnos del día" subtitle="Un turno no habilita la entrega: el dispensario vuelve a validar REPROCANN y topes">
          {board.appointments.length === 0 ? (
            <Empty>No hay turnos para {day.short}.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="data">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Socio</th>
                    <th>Canal</th>
                    <th>Estado</th>
                    <th style={{ width: 300 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {board.appointments.map((a) => {
                    const st = APPOINTMENT_STATUS[a.status] ?? { label: a.status, tone: "mute" as const };
                    const open = ["PENDIENTE", "CONFIRMADO"].includes(a.status);
                    return (
                      <tr key={a.id}>
                        <td className="tnum" style={{ fontWeight: 700 }}>{a.label}</td>
                        <td>
                          <div className="cell-main">{a.memberName}</div>
                          <div className="cell-meta">Legajo {a.legajo}</div>
                        </td>
                        <td className="cell-meta">{APPOINTMENT_CHANNEL[a.channel] ?? a.channel}</td>
                        <td>
                          <Chip tone={st.tone}>{st.label}</Chip>
                          {a.dispatchId ? <div className="cell-meta">entrega registrada</div> : null}
                        </td>
                        <td>
                          {open ? (
                            <div className="flex items-center gap-1.5">
                              {a.status === "PENDIENTE" ? (
                                <button className="btn btn-sm" disabled={busy} onClick={() => setStatus(a.id, "CONFIRMADO")}>
                                  Confirmar
                                </button>
                              ) : null}
                              <Link className="btn btn-sm btn-secondary" href={`/dispensario?socio=${a.memberId}`}>
                                Entregar
                              </Link>
                              <details className="more">
                                <summary className="btn btn-sm btn-secondary">Más</summary>
                                <div className="more-menu">
                                  <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => setStatus(a.id, "AUSENTE")}>
                                    No vino
                                  </button>
                                  <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => cancel(a.id)}>
                                    Cancelar turno
                                  </button>
                                </div>
                              </details>
                            </div>
                          ) : (
                            <span className="cell-meta">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
