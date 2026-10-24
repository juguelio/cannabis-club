"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { REPROCANN_STATUS } from "@/lib/labels";

type Details = { phone: string; email: string; address: string; reprocannNumber: string; reprocannStatus: string; reprocannExpiresAt: string; consentSignedAt: string };
export function MemberEditor({ id, initial }: { id: string; initial: Details }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const fields = [["phone", "Teléfono", "tel"], ["email", "Email", "email"], ["address", "Domicilio", "text"], ["reprocannNumber", "Número REPROCANN", "text"], ["reprocannExpiresAt", "Vencimiento REPROCANN", "date"], ["consentSignedAt", "Consentimiento firmado", "date"]] as const;
  return <details className="card card-pad mb-5"><summary className="section-title cursor-pointer">Actualizar contacto y documentación</summary>
    <p className="page-sub mb-4">Renová el REPROCANN o completá el legajo sin volver a dar de alta al socio.</p>
    <form onSubmit={async e => {
      e.preventDefault(); if (busy) return;
      const data = Object.fromEntries(new FormData(e.currentTarget));
      setBusy(true); setMessage(""); setError(false);
      try {
        const res = await fetch(`/api/members/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        const body = await res.json(); if (!res.ok) throw new Error(body.message ?? "No se pudo guardar.");
        setMessage("Legajo actualizado."); router.refresh();
      } catch (err) { setError(true); setMessage(err instanceof Error ? err.message : "No se pudo conectar."); }
      finally { setBusy(false); }
    }}><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map(([name, label, type]) => <label className="label" key={name}>{label}<input name={name} type={type} defaultValue={initial[name]} className="input mt-2" /></label>)}
      <label className="label">Estado REPROCANN<select name="reprocannStatus" defaultValue={initial.reprocannStatus} className="select mt-2">{Object.entries(REPROCANN_STATUS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
    </fieldset><button className="btn mt-4" disabled={busy}>{busy ? "Guardando…" : "Guardar legajo"}</button>
    {message && <p role={error ? "alert" : "status"} className={`alert mt-3 ${error ? "alert-danger" : "alert-ok"}`}>{message}</p>}
    </form></details>;
}
