"use client";

import { ValidatedForm, Input, Select } from "./validated-form";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, UserPlus } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { Dialog } from "./dialog";
import { useToast } from "./toast";

type User = { id: string; email: string; name: string; role: string; active: boolean; lastLoginAt: string | null };
const ROLE: Record<string, string> = { ADMIN: "Administración", OPERADOR: "Operador", DISPENSADOR: "Dispensario" };

export function TeamManager({ users, meId }: { users: User[]; meId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState<User | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(u: User, body: Record<string, unknown>, ok: string) {
    setBusy(u.id);
    try {
      await api(`/api/users/${u.id}`, { method: "PATCH", body });
      toast({ tone: "ok", title: ok });
      router.refresh();
    } catch (err) {
      toast({ tone: "bad", title: "No se pudo guardar", text: errMsg(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2 className="panel-title">Equipo</h2><p className="panel-sub">Mostrador registra entregas, turnos, socios y stock. Administración además anula entregas, destruye lotes y cambia la configuración.</p></div>
        <button className="btn" onClick={() => { setError(null); setCreating(true); }}><UserPlus aria-hidden />Sumar a alguien</button>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Persona</th><th>Rol</th><th className="hide-sm">Último ingreso</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={u.active ? undefined : { opacity: 0.55 }}>
                <td><div className="cell-main">{u.name}{u.id === meId ? " (vos)" : ""}</div><div className="cell-meta">{u.email}{u.active ? "" : " · desactivada"}</div></td>
                <td>
                  <ValidatedForm onSubmit={({ values }) => {
                    const role = String(values.role);
                    return patch(u, { role }, `${u.name}: ${ROLE[role]}`);
                  }}>
                    <Select name="role"
                      className="select"
                      style={{ minHeight: 34, width: "auto", padding: "4px 8px" }}
                      aria-label={`Rol de ${u.name}`}
                      value={u.role}
                      disabled={busy === u.id || u.id === meId || !u.active}
                      onChange={event => event.currentTarget.form?.requestSubmit()}
                    >
                      <option value="DISPENSADOR">Dispensario</option>
                      <option value="OPERADOR">Operador</option>
                      <option value="ADMIN">Administración</option>
                    </Select>
                  </ValidatedForm>
                </td>
                <td className="cell-meta hide-sm">{u.lastLoginAt ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(u.lastLoginAt)) : "Nunca"}</td>
                <td className="num">
                  <div className="flex justify-end gap-1">
                    <button className="btn btn-sm btn-ghost" onClick={() => { setError(null); setResetFor(u); }} disabled={!u.active}><KeyRound aria-hidden />Clave</button>
                    {u.id !== meId ? (
                      <button className="btn btn-sm btn-ghost" disabled={busy === u.id} onClick={() => patch(u, { active: !u.active }, u.active ? `${u.name} ya no puede ingresar` : `${u.name} puede volver a ingresar`)}>
                        {u.active ? "Desactivar" : "Reactivar"}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={creating} onClose={() => setCreating(false)} title="Sumar al equipo" labelledBy="team-new">
        <ValidatedForm
          onSubmit={async (e, reportFields) => {
            const { values } = e;
            setBusy("new");
            setError(null);
            try {
              await api("/api/users", { body: { name: values.name, email: values.email, role: values.role, password: values.password } });
              toast({ tone: "ok", title: "Cuenta creada", text: "Pasale el email y la clave en persona." });
              setCreating(false);
              router.refresh();
            } catch (err) {
              if (!reportFields(err)) setError(errMsg(err));
            } finally {
              setBusy(null);
            }
          }}
        >
          <div className="dlg-body stack" style={{ gap: 12 }}>
            <div><label className="label" htmlFor="t-name">Nombre</label><Input className="input" id="t-name" name="name" required /></div>
            <div><label className="label" htmlFor="t-email">Email</label><Input className="input" id="t-email" name="email" type="email" required /></div>
            <div>
              <label className="label" htmlFor="t-role">Rol</label>
              <Select className="select" id="t-role" name="role" defaultValue="OPERADOR"><option value="DISPENSADOR">Dispensario</option><option value="OPERADOR">Operador</option><option value="ADMIN">Administración</option></Select>
            </div>
            <div><label className="label" htmlFor="t-pass">Clave inicial</label><Input className="input" id="t-pass" name="password" type="text" minLength={10} required autoComplete="new-password" /><span className="hint">Al menos 10 caracteres.</span></div>
            {error ? <div className="note note-danger">{error}</div> : null}
          </div>
          <div className="dlg-foot"><button type="button" className="btn btn-quiet" onClick={() => setCreating(false)}>Cancelar</button><button className="btn" disabled={busy === "new"}>Crear cuenta</button></div>
        </ValidatedForm>
      </Dialog>

      <Dialog open={resetFor != null} onClose={() => setResetFor(null)} title={`Clave nueva para ${resetFor?.name ?? ""}`} labelledBy="team-reset">
        <ValidatedForm
          onSubmit={async (e, reportFields) => {
            if (!resetFor) return;
            const pw = String(e.values.password ?? "");
            setBusy(resetFor.id);
            setError(null);
            try {
              await api(`/api/users/${resetFor.id}`, { method: "PATCH", body: { password: pw } });
              toast({ tone: "ok", title: "Clave cambiada" });
              setResetFor(null);
            } catch (err) {
              if (!reportFields(err)) setError(errMsg(err));
            } finally {
              setBusy(null);
            }
          }}
        >
          <div className="dlg-body stack" style={{ gap: 12 }}>
            <div><label className="label" htmlFor="t-np">Clave nueva</label><Input className="input" id="t-np" name="password" type="text" minLength={10} required autoComplete="new-password" autoFocus /></div>
            {error ? <div className="note note-danger">{error}</div> : null}
          </div>
          <div className="dlg-foot"><button type="button" className="btn btn-quiet" onClick={() => setResetFor(null)}>Cancelar</button><button className="btn">Guardar clave</button></div>
        </ValidatedForm>
      </Dialog>
    </section>
  );
}
