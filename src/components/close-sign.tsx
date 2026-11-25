"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ValidatedForm, Input, type FormSubmission, type ReportFields } from "./validated-form";
import { api, errMsg } from "@/lib/client";
import { useToast } from "@/components/toast";

/** Firma del cierre mensual: congela los totales del período (REA 3). */
export function CloseSign({ period }: { period: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sign({ values }: FormSubmission, reportFields: ReportFields) {
    if (!window.confirm(`Firmar el cierre de ${period}. Los totales quedan congelados: corregirlos después requiere un cierre nuevo. ¿Seguir?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ close: { hash: string } }>("/api/close", { body: { period, note: String(values.note ?? "").trim() || undefined } });
      toast({ tone: "ok", title: "Cierre firmado", text: `Huella ${res.close.hash.slice(0, 12)}… guardada con el período.` });
      router.refresh();
    } catch (err) {
      if (!reportFields(err)) setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ValidatedForm className="stack" style={{ gap: 10 }} onSubmit={sign}>
      <div>
        <label className="label" htmlFor="close-note">Nota del cierre (opcional)</label>
        <Input name="note" id="close-note" className="input" placeholder="Ej.: mes con recall del lote L-2026-002" />
      </div>
      {error ? <div className="note note-warn" role="alert">{error}</div> : null}
      <div>
        <button className="btn" type="submit" disabled={busy}>{busy ? "Firmando…" : `Firmar cierre de ${period}`}</button>
      </div>
    </ValidatedForm>
  );
}
