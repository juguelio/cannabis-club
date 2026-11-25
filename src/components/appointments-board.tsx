"use client";

import { ValidatedForm, Input, Select, type FormSubmission, type ReportFields } from "./validated-form";

import { useState } from "react";
import Link from "next/link";
import { CalendarX2, ChevronLeft, ChevronRight } from "lucide-react";
import { Chip, Empty, Panel } from "@/components/ui";
import { APPOINTMENT_CHANNEL, APPOINTMENT_STATUS, WEEKDAYS } from "@/lib/labels";
import type { DayBoard } from "@/lib/appointments-db";
import { api, errMsg } from "@/lib/client";
import { MemberPicker } from "./member-picker";
import { ReasonDialog } from "./dialog";
import { useToast } from "./toast";

type MemberOption = { id: string; legajo: number; name: string; docLast4?: string | null };

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

export function AppointmentsBoard({ initial, today, members }: { initial: DayBoard; today: string; members: MemberOption[] }) {
  const toast = useToast();
  const [board, setBoard] = useState<DayBoard>(initial);
  const [slot, setSlot] = useState<number | null>(null);
  const [memberId, setMemberId] = useState("");
  const [channel, setChannel] = useState("MOSTRADOR");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function load(day: string) {
    setBusy(true);
    try {
      setBoard(await api<DayBoard>(`/api/appointments?date=${day}`));
      setSlot(null);
    } catch (error) {
      toast({ tone: "bad", title: "No se pudieron cargar los turnos", text: errMsg(error) });
    } finally {
      setBusy(false);
    }
  }

  async function reserve(_: FormSubmission, reportFields: ReportFields) {
    if (slot == null || !memberId) return;
    setBusy(true);
    try {
      const data = await api<{ board: DayBoard; appointment: { member: { lastName: string } } }>("/api/appointments", {
        body: { memberId, date: board.day, startMin: slot, channel, notes: notes || undefined },
      });
      const label = data.board.slots.find((s) => s.startMin === slot)?.label ?? "";
      setBoard(data.board);
      toast({ tone: "ok", title: `Turno agendado a las ${label}`, text: `${data.appointment.member.lastName}, ${fmtDay(board.day).long}.` });
      setNotes("");
      setSlot(null);
      setMemberId("");
    } catch (error) {
      if (!reportFields(error)) toast({ tone: "bad", title: "No se pudo agendar", text: errMsg(error) });
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string, reason?: string) {
    setBusy(true);
    try {
      const data = await api<{ board: DayBoard }>(`/api/appointments/${id}/status`, { body: { status, reason } });
      setBoard(data.board);
      return true;
    } catch (error) {
      if (status === "CANCELADO") setCancelError(errMsg(error));
      else toast({ tone: "bad", title: "No se pudo actualizar el turno", text: errMsg(error) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const day = fmtDay(board.day);
  const libres = board.slots.filter((s) => !s.past).reduce((a, s) => a + s.free, 0);
  const chosen = board.slots.find((s) => s.startMin === slot);

  return (
    <>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="flex flex-wrap items-center justify-between gap-3" style={{ padding: "12px 14px" }}>
          <div className="flex items-center gap-2">
            <button className="icon-btn" onClick={() => load(shift(board.day, -1))} disabled={busy} aria-label="Día anterior"><ChevronLeft /></button>
            <div style={{ minWidth: 150 }}>
              <div className="display" style={{ fontWeight: 650, fontSize: 19, textTransform: "capitalize" }}>{board.day === today ? `Hoy, ${day.long}` : day.long}</div>
              <div className="cell-meta tnum">
                {board.summary.total} {board.summary.total === 1 ? "turno" : "turnos"}, {libres} {libres === 1 ? "lugar libre" : "lugares libres"}
              </div>
            </div>
            <button className="icon-btn" onClick={() => load(shift(board.day, 1))} disabled={busy} aria-label="Día siguiente"><ChevronRight /></button>
            {board.day !== today ? <button className="btn btn-sm btn-quiet" onClick={() => load(today)} disabled={busy}>Volver a hoy</button> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="brand">Por llegar {board.summary.porLlegar}</Chip>
            <Chip tone="ok">Atendidos {board.summary.atendidos}</Chip>
            {board.summary.ausentes ? <Chip tone="warn">No vinieron {board.summary.ausentes}</Chip> : null}
            {board.summary.cancelados ? <Chip>Cancelados {board.summary.cancelados}</Chip> : null}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <Panel
          title="Horarios"
          subtitle={board.slots.length ? "Elegí un horario libre. El cupo es por turno, no por día." : undefined}
        >
          {board.slots.length === 0 ? (
            <Empty icon={CalendarX2} title="El dispensario no abre este día">
              {board.openingHours.length ? `Atiende ${board.openingHours.map((h) => h.label).join(", ")}.` : "Falta configurar las franjas de atención."}
            </Empty>
          ) : (
            <div className="panel-body slot-grid" role="radiogroup" aria-label="Horarios del día">
              {board.slots.map((s) => (
                <button
                  key={s.at}
                  type="button"
                  className="slot"
                  disabled={s.full || s.past}
                  aria-pressed={s.startMin === slot}
                  onClick={() => setSlot(s.startMin)}
                  title={s.past ? "Ya pasó" : s.full ? "Completo" : `${s.free} de ${s.capacity} libres`}
                >
                  {s.label}
                  <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, opacity: 0.75 }}>{s.past ? "pasó" : s.full ? "completo" : `${s.free}/${s.capacity}`}</span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Agendar turno" subtitle={chosen ? `${day.long} a las ${chosen.label}.` : "Primero elegí un horario."}>
          <ValidatedForm className="panel-body stack" style={{ gap: 12 }} onSubmit={reserve}>
            <MemberPicker members={members} value={memberId} onChange={setMemberId} />
            <div className="field-row">
              <div>
                <label className="label" htmlFor="ap-ch">Pedido por</label>
                <Select className="select" id="ap-ch" name="channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
                  {Object.entries(APPOINTMENT_CHANNEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </div>
              <div>
                <label className="label" htmlFor="ap-n">Nota</label>
                <Input className="input" id="ap-n" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <button className="btn" disabled={busy || !memberId || slot == null}>
              {busy ? "Guardando…" : chosen ? `Agendar a las ${chosen.label}` : "Agendar turno"}
            </button>
          </ValidatedForm>
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title="Turnos del día" subtitle="Un turno no habilita la entrega: el dispensario vuelve a validar REPROCANN y topes.">
          {board.appointments.length === 0 ? (
            <Empty>No hay turnos para el {day.short}.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Hora</th><th>Socio</th><th className="hide-sm">Pedido por</th><th>Estado</th><th /></tr>
                </thead>
                <tbody>
                  {board.appointments.map((a) => {
                    const st = APPOINTMENT_STATUS[a.status] ?? { label: a.status, tone: "mute" as const };
                    const open = ["PENDIENTE", "CONFIRMADO"].includes(a.status);
                    return (
                      <tr key={a.id}>
                        <td className="tnum display" style={{ fontWeight: 650, fontSize: 16 }}>{a.label}</td>
                        <td>
                          <Link className="row-link" href={`/socios/${a.memberId}`}><div className="cell-main">{a.memberName}</div></Link>
                          <div className="cell-meta">Legajo {a.legajo}{a.notes ? ` · ${a.notes}` : ""}</div>
                        </td>
                        <td className="cell-meta hide-sm">{APPOINTMENT_CHANNEL[a.channel] ?? a.channel}</td>
                        <td><Chip tone={st.tone}>{st.label}</Chip>{a.dispatchId ? <div className="cell-meta">con entrega</div> : null}</td>
                        <td className="num">
                          {open ? (
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              {a.status === "PENDIENTE" ? <button className="btn btn-sm btn-quiet" disabled={busy} onClick={() => setStatus(a.id, "CONFIRMADO")}>Confirmar</button> : null}
                              <Link className="btn btn-sm" href={`/dispensario?socio=${a.memberId}`}>Entregar</Link>
                              <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setStatus(a.id, "AUSENTE")}>No vino</button>
                              <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => { setCancelError(null); setCanceling(a.id); }}>Cancelar</button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <ReasonDialog
        open={canceling != null}
        onClose={() => setCanceling(null)}
        title="Cancelar el turno"
        description="El horario se libera para otro socio."
        confirmLabel="Cancelar turno"
        reasonLabel="Motivo"
        danger
        busy={busy}
        error={cancelError}
        onConfirm={async (reason) => {
          if (!canceling) return;
          if (await setStatus(canceling, "CANCELADO", reason)) {
            toast({ tone: "ok", title: "Turno cancelado" });
            setCanceling(null);
          }
        }}
      />
    </>
  );
}
