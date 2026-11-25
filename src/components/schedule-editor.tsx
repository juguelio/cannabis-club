"use client";

import { ValidatedForm, Input, type ReportFields } from "./validated-form";

import { ApiError } from "@/lib/client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Rule = { id: string; weekday: number; startMin: number; endMin: number; slotMin: number; capacity: number; active: boolean };
type Closed = { id: string; date: string; reason: string | null };

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function ScheduleEditor({ rules, closed }: { rules: Rule[]; closed: Closed[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [capacity, setCapacity] = useState<Record<string, number>>(
    Object.fromEntries(rules.map((r) => [r.id, r.capacity])),
  );
  const [nuevoDia, setNuevoDia] = useState("");
  const [motivo, setMotivo] = useState("");

  async function saveRule(rule: Rule, patch: { capacity?: number; active?: boolean }) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/schedule-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "No se pudo guardar la franja");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addRule(weekday: number) {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/schedule-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekday, startMin: 600, endMin: 1140, slotMin: 20, capacity: 2 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "No se pudo abrir el día");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addClosedDay(e: React.FormEvent, reportFields: ReportFields) {
    e.preventDefault();
    if (!nuevoDia) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/closed-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: nuevoDia, reason: motivo.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new ApiError(data.error, data.message ?? "No se pudo cerrar el día", res.status, data.details);
      setNuevoDia(""); setMotivo("");
      router.refresh();
    } catch (err) {
      if (!reportFields(err)) setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeClosedDay(id: string) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/closed-days/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "No se pudo reabrir el día");
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card card-pad" style={{ minWidth: 0 }}>
        <div className="section-title mb-2">Franjas de atención</div>
        <p className="cell-meta mb-3">El cupo es por franja, no por día. Pausar una franja la saca de la reserva sin borrar los turnos ya tomados.</p>
        <div className="overflow-x-auto">
          <table className="data">
            <thead>
              <tr><th>Día</th><th>Horario</th><th>Cada</th><th>Cupo</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((nombre, weekday) => {
                const r = rules.find((x) => x.weekday === weekday);
                if (!r) {
                  return (
                    <tr key={`sin-${weekday}`}>
                      <td>{nombre}</td>
                      <td className="cell-meta">Sin franja</td>
                      <td className="cell-meta">—</td>
                      <td className="cell-meta">—</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => addRule(weekday)}>
                          Abrir 10:00–19:00
                        </button>
                      </td>
                    </tr>
                  );
                }
                return (
                <tr key={r.id}>
                  <td>{WEEKDAYS[r.weekday]}</td>
                  <td className="cell-meta tnum">{hhmm(r.startMin)}–{hhmm(r.endMin)}</td>
                  <td className="cell-meta tnum">{r.slotMin}′</td>
                  <td>
                    <input
                      className="input tnum"
                      style={{ width: 64 }}
                      type="number"
                      min={1}
                      max={20}
                      value={capacity[r.id] ?? r.capacity}
                      onChange={(e) => setCapacity((c) => ({ ...c, [r.id]: Number(e.target.value) }))}
                      onBlur={() => {
                        const v = capacity[r.id] ?? r.capacity;
                        if (v !== r.capacity) saveRule(r, { capacity: v });
                      }}
                      aria-label={`Cupo ${WEEKDAYS[r.weekday]} ${hhmm(r.startMin)}`}
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => saveRule(r, { active: !r.active })}
                    >
                      {r.active ? "Pausar" : "Activar"}
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-pad" style={{ minWidth: 0 }}>
        <div className="section-title mb-2">Días cerrados</div>
        <p className="cell-meta mb-3">Un día cerrado no acepta turnos ni reservas, aunque tenga franjas.</p>
        <ValidatedForm className="flex flex-wrap items-end gap-2 mb-3" onSubmit={addClosedDay}>
          <div>
            <label className="label" htmlFor="closed-date">Fecha</label>
            <Input id="closed-date" required className="input" type="date" name="date" value={nuevoDia} onChange={(e) => setNuevoDia(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="label" htmlFor="closed-reason">Motivo</label>
            <Input id="closed-reason" className="input" name="reason" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Feriado, mantenimiento…" />
          </div>
          <button className="btn btn-sm" disabled={busy}>Cerrar día</button>
        </ValidatedForm>
        {closed.length === 0 ? (
          <p className="cell-meta">No hay días cerrados.</p>
        ) : (
          <table className="data">
            <tbody>
              {closed.map((c) => (
                <tr key={c.id}>
                  <td className="tnum">{c.date}</td>
                  <td className="cell-meta">{c.reason ?? "—"}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => removeClosedDay(c.id)}>
                      Reabrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
    </div>
  );
}
