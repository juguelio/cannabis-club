"use client";

import { ValidatedForm, Input, type ReportFields } from "./validated-form";
import { api, errMsg } from "@/lib/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function BatchActions({ id, stage }: { id: string; stage: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function move(next: string, reportFields: ReportFields) {
    if (next === "CUARENTENA" && !reason.trim()) {
      setError(null);
      reportFields([{ campo: "reason", mensaje: "Escribí el motivo para dejar el lote en cuarentena." }]);
      return;
    }
    if (next === "DESTRUIDO" && !window.confirm("Marcar el lote como destruido. Esta acción queda auditada. ¿Seguir?")) return;
    setBusy(true); setError(null);
    try {
      await api(`/api/batches/${id}/stage`, { body: { stage: next, reason: reason.trim() || undefined } });
      setReason("");
      router.refresh();
    } catch (err) {
      if (!reportFields(err)) setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ValidatedForm className="flex flex-col gap-2" onSubmit={(event, report) => {
      const button = (event.nativeEvent as SubmitEvent).submitter;
      if (button instanceof HTMLButtonElement) return move(button.value, report);
    }}>
      <Input name="reason" aria-label="Motivo del cambio de etapa"
        className="input"
        placeholder="Motivo (obligatorio para cuarentena)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        {stage !== "CUARENTENA" ? (
          <button className="btn btn-secondary btn-sm" disabled={busy} type="submit" value="CUARENTENA">
            Poner en cuarentena
          </button>
        ) : (
          <button className="btn btn-sm" disabled={busy} type="submit" value="DISPONIBLE">
            Liberar lote
          </button>
        )}
        {stage !== "DESTRUIDO" ? (
          <button className="btn btn-secondary btn-sm" disabled={busy} type="submit" value="DESTRUIDO">
            Marcar destruido
          </button>
        ) : null}
      </div>
      {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
    </ValidatedForm>
  );
}
