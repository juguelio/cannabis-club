"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Pencil, UserCheck, UserMinus, UserX } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { REPROCANN_STATUS } from "@/lib/labels";
import { Dialog, ReasonDialog } from "./dialog";
import { useToast } from "./toast";

type Details = {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  reprocannNumber: string;
  reprocannStatus: string;
  reprocannExpiresAt: string;
  consentSignedAt: string;
  consumptionType: string;
  monthlyForecastG: string;
  notes: string;
};

/** Edición del legajo en un diálogo: contacto, REPROCANN, consumo y notas. */
export function MemberEditor({ id, initial, isAdmin }: { id: string; initial: Details; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button className="btn btn-quiet" onClick={() => { setError(null); setOpen(true); }}><Pencil aria-hidden />Editar legajo</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Editar legajo" labelledBy="edit-title" className="dlg-wide">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const payload: Record<string, unknown> = {};
            for (const key of ["phone", "email", "address", "reprocannNumber", "reprocannStatus", "reprocannExpiresAt", "consentSignedAt", "consumptionType", "notes"] as const) {
              const v = String(f.get(key) ?? "").trim();
              if (v !== initial[key]) payload[key] = v;
            }
            const forecast = String(f.get("monthlyForecastG") ?? "").trim().replace(",", ".");
            if (forecast !== initial.monthlyForecastG) payload.monthlyForecastG = forecast === "" ? null : Number(forecast);
            if (isAdmin) {
              for (const key of ["firstName", "lastName", "birthDate"] as const) {
                const v = String(f.get(key) ?? "").trim();
                if (v && v !== initial[key]) payload[key] = v;
              }
            }
            if (Object.keys(payload).length === 0) { setOpen(false); return; }
            setBusy(true);
            setError(null);
            try {
              await api(`/api/members/${id}`, { method: "PATCH", body: payload });
              toast({ tone: "ok", title: "Legajo actualizado", text: `${Object.keys(payload).length} ${Object.keys(payload).length === 1 ? "dato" : "datos"} con registro en la auditoría.` });
              setOpen(false);
              router.refresh();
            } catch (err) {
              setError(errMsg(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="dlg-body stack" style={{ gap: 18 }}>
            {isAdmin ? (
              <div className="field-row">
                <div><label className="label" htmlFor="e-last">Apellido</label><input className="input" id="e-last" name="lastName" defaultValue={initial.lastName} /></div>
                <div><label className="label" htmlFor="e-first">Nombre</label><input className="input" id="e-first" name="firstName" defaultValue={initial.firstName} /></div>
                <div><label className="label" htmlFor="e-birth">Nacimiento</label><input className="input" id="e-birth" type="date" name="birthDate" defaultValue={initial.birthDate} /></div>
              </div>
            ) : null}
            <div className="field-row">
              <div><label className="label" htmlFor="e-phone">Teléfono</label><input className="input" id="e-phone" name="phone" type="tel" defaultValue={initial.phone} /></div>
              <div><label className="label" htmlFor="e-email">Email</label><input className="input" id="e-email" name="email" type="email" defaultValue={initial.email} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label className="label" htmlFor="e-addr">Domicilio</label><input className="input" id="e-addr" name="address" defaultValue={initial.address} /></div>
            </div>
            <div className="field-row">
              <div><label className="label" htmlFor="e-rnum">N° REPROCANN</label><input className="input" id="e-rnum" name="reprocannNumber" defaultValue={initial.reprocannNumber} /></div>
              <div>
                <label className="label" htmlFor="e-rst">Estado REPROCANN</label>
                <select className="select" id="e-rst" name="reprocannStatus" defaultValue={initial.reprocannStatus}>
                  {Object.entries(REPROCANN_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label.replace("REPROCANN ", "")}</option>)}
                </select>
              </div>
              <div><label className="label" htmlFor="e-rexp">Vence</label><input className="input" id="e-rexp" type="date" name="reprocannExpiresAt" defaultValue={initial.reprocannExpiresAt} /></div>
            </div>
            <div className="field-row">
              <div>
                <label className="label" htmlFor="e-cons">Tipo de consumo</label>
                <select className="select" id="e-cons" name="consumptionType" defaultValue={initial.consumptionType}>
                  <option value="TERAPEUTICO">Terapéutico</option>
                  <option value="LUDICO">Lúdico</option>
                </select>
              </div>
              <div><label className="label" htmlFor="e-fc">Previsión mensual (g)</label><input className="input tnum" id="e-fc" name="monthlyForecastG" inputMode="decimal" defaultValue={initial.monthlyForecastG} /></div>
              <div><label className="label" htmlFor="e-consent">Consentimiento firmado el</label><input className="input" id="e-consent" type="date" name="consentSignedAt" defaultValue={initial.consentSignedAt} /></div>
            </div>
            <div><label className="label" htmlFor="e-notes">Notas internas</label><textarea className="textarea" id="e-notes" name="notes" defaultValue={initial.notes} /></div>
            {error ? <div className="note note-danger" role="alert">{error}</div> : null}
          </fieldset>
          <div className="dlg-foot">
            <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

const STATUS_ACTIONS: Record<string, { to: string; label: string; icon: React.ElementType; danger?: boolean; needsReason: boolean; text: string }[]> = {
  PENDIENTE: [{ to: "ACTIVO", label: "Activar", icon: UserCheck, needsReason: false, text: "El socio queda habilitado para reservar y retirar, siempre que su REPROCANN esté vigente." }],
  ACTIVO: [
    { to: "SUSPENDIDO", label: "Suspender", icon: UserMinus, needsReason: true, text: "No podrá retirar ni reservar hasta que se lo reactive. Sus entregas anteriores no cambian." },
    { to: "BAJA", label: "Dar de baja", icon: UserX, danger: true, needsReason: true, text: "Sale del padrón activo. El legajo y su historial se conservan." },
  ],
  SUSPENDIDO: [
    { to: "ACTIVO", label: "Reactivar", icon: UserCheck, needsReason: false, text: "Vuelve a estar habilitado para reservar y retirar." },
    { to: "BAJA", label: "Dar de baja", icon: UserX, danger: true, needsReason: true, text: "Sale del padrón activo. El legajo y su historial se conservan." },
  ],
  BAJA: [{ to: "PENDIENTE", label: "Reincorporar", icon: UserCheck, needsReason: true, text: "Vuelve como pendiente de alta: habrá que revisar su documentación y activarlo." }],
};

export function MemberStatusActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [action, setAction] = useState<(typeof STATUS_ACTIONS)[string][number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actions = STATUS_ACTIONS[status] ?? [];

  return (
    <>
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <button key={a.to} className={`btn ${a.danger ? "btn-danger" : a.to === "ACTIVO" ? "" : "btn-quiet"}`} onClick={() => { setError(null); setAction(a); }}>
            <Icon aria-hidden />{a.label}
          </button>
        );
      })}
      <ReasonDialog
        open={action != null}
        onClose={() => setAction(null)}
        title={action ? `${action.label} al socio` : ""}
        description={action?.text}
        confirmLabel={action?.label ?? ""}
        reasonLabel={action?.needsReason ? "Motivo" : "Nota (opcional)"}
        reasonRequired={Boolean(action?.needsReason)}
        danger={action?.danger}
        busy={busy}
        error={error}
        onConfirm={async (reason) => {
          if (!action) return;
          setBusy(true);
          setError(null);
          try {
            await api(`/api/members/${id}`, { method: "PATCH", body: { status: action.to, statusReason: reason || undefined } });
            toast({ tone: "ok", title: `Socio ${action.to === "ACTIVO" ? "activado" : action.to === "BAJA" ? "dado de baja" : action.to === "SUSPENDIDO" ? "suspendido" : "reincorporado"}` });
            setAction(null);
            router.refresh();
          } catch (err) {
            setError(errMsg(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

/** Acceso al portal: crear, renovar clave o quitar. La clave temporal se ve una sola vez. */
export function PortalAccess({ id, email, hasAccess, canGrant }: { id: string; email: string | null; hasAccess: boolean; canGrant: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  async function grant() {
    setBusy(true);
    try {
      const r = await api<{ email: string; password: string }>(`/api/members/${id}/access`, { body: {} });
      setResult(r);
      router.refresh();
    } catch (err) {
      toast({ tone: "bad", title: "No se pudo dar el acceso", text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        {hasAccess
          ? `Entra al portal con ${email}. Desde ahí ve su saldo del mes y reserva retiros.`
          : canGrant
            ? email ? `Se crea una cuenta con ${email} y una clave temporal para dictarle.` : "Cargá un email en el legajo para darle acceso."
            : "Sólo un socio activo puede tener acceso al portal."}
      </p>
      <div className="flex flex-wrap gap-2">
        {canGrant && email ? (
          <button className="btn btn-sm btn-quiet" onClick={grant} disabled={busy}><KeyRound aria-hidden />{hasAccess ? "Nueva clave temporal" : "Dar acceso al portal"}</button>
        ) : null}
        {hasAccess ? <button className="btn btn-sm btn-ghost" onClick={() => setConfirmRevoke(true)} disabled={busy}>Quitar acceso</button> : null}
      </div>

      <Dialog open={result != null} onClose={() => setResult(null)} title="Acceso listo" labelledBy="access-title"
        footer={<button className="btn" onClick={() => setResult(null)}>Listo, ya la anoté</button>}>
        <div className="dlg-body stack" style={{ gap: 12 }}>
          <p className="muted" style={{ margin: 0 }}>Dictale estos datos al socio. Por seguridad, la clave no se vuelve a mostrar: si la pierde, generás otra.</p>
          <dl className="dl">
            <dt>Email</dt><dd>{result?.email}</dd>
            <dt>Clave temporal</dt>
            <dd className="flex items-center gap-2">
              <code style={{ fontSize: 20, fontWeight: 700, letterSpacing: ".04em" }}>{result?.password}</code>
              <button className="icon-btn" aria-label="Copiar clave" onClick={() => { void navigator.clipboard?.writeText(result?.password ?? ""); toast({ tone: "ok", title: "Clave copiada" }); }}><Copy /></button>
            </dd>
          </dl>
        </div>
      </Dialog>

      <Dialog open={confirmRevoke} onClose={() => setConfirmRevoke(false)} title="Quitar acceso al portal" labelledBy="revoke-title"
        footer={
          <>
            <button className="btn btn-quiet" onClick={() => setConfirmRevoke(false)}>Volver</button>
            <button className="btn btn-danger-solid" disabled={busy} onClick={async () => {
              setBusy(true);
              try {
                await api(`/api/members/${id}/access`, { method: "DELETE" });
                toast({ tone: "ok", title: "Acceso quitado" });
                setConfirmRevoke(false);
                router.refresh();
              } catch (err) {
                toast({ tone: "bad", title: "No se pudo quitar", text: errMsg(err) });
              } finally {
                setBusy(false);
              }
            }}>Quitar acceso</button>
          </>
        }>
        <div className="dlg-body"><p className="muted" style={{ margin: 0 }}>La cuenta queda desactivada al instante. Sus reservas abiertas siguen en pie hasta que se retiren o se cancelen.</p></div>
      </Dialog>
    </div>
  );
}
