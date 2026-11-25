"use client";

import { ValidatedForm, Input, type FormSubmission, type ReportFields } from "./validated-form";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";

import { z } from "zod";

const passwordSchema = z.object({ current: z.string(), next: z.string(), repeat: z.string() })
  .refine(({ next, repeat }) => next === repeat, { path: ["repeat"], message: "Las dos claves nuevas no coinciden." });

/** Cambio de clave propio: al guardar, el servidor invalida las sesiones viejas. */
export function ChangePasswordForm({ redirectTo = "/portal", label = "Guardar clave" }: { redirectTo?: string; label?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit({ values: { current, next } }: FormSubmission, reportFields: ReportFields) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/password", { body: { current, next } });
      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      if (!reportFields(err)) setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ValidatedForm schema={passwordSchema} className="stack" style={{ gap: 14 }} onSubmit={submit}>
      <div>
        <label className="label" htmlFor="pw-current">Clave actual (la temporal)</label>
        <Input id="pw-current" className="input" type="password" autoComplete="current-password" name="current" required />
      </div>
      <div>
        <label className="label" htmlFor="pw-next">Clave nueva</label>
        <Input id="pw-next" className="input" type="password" autoComplete="new-password" minLength={8} name="next" required />
        <span className="hint">Mínimo 8 caracteres, con letras. No puede ser sólo números.</span>
      </div>
      <div>
        <label className="label" htmlFor="pw-repeat">Repetir la clave nueva</label>
        <Input id="pw-repeat" className="input" type="password" autoComplete="new-password" minLength={8} name="repeat" required />
      </div>
      {error ? <div className="note note-warn" role="alert">{error}</div> : null}
      <div>
        <button className="btn" type="submit" disabled={busy}>{busy ? "Guardando…" : label}</button>
      </div>
      <p className="cell-meta" style={{ margin: 0 }}>
        Si perdiste el acceso, pedí una clave nueva en la secretaría del club: no se puede recuperar por email.
      </p>
    </ValidatedForm>
  );
}
