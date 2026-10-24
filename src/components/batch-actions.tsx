"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BatchActions({ id, stage }: { id: string; stage: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function move(next: string) {
    if (next === "CUARENTENA" && !reason.trim()) {
      setError("Escribí el motivo de la cuarentena: después se audita.");
      return;
    }
    if (next === "DESTRUIDO" && !window.confirm("Marcar el lote como destruido. Esta acción queda auditada. ¿Seguir?")) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/batches/${id}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "No se pudo cambiar la etapa");
      setReason("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        className="input"
        placeholder="Motivo (obligatorio para cuarentena)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        {stage !== "CUARENTENA" ? (
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => move("CUARENTENA")}>
            Poner en cuarentena
          </button>
        ) : (
          <button className="btn btn-sm" disabled={busy} onClick={() => move("DISPONIBLE")}>
            Liberar lote
          </button>
        )}
        {stage !== "DESTRUIDO" ? (
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => move("DESTRUIDO")}>
            Marcar destruido
          </button>
        ) : null}
      </div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
    </div>
  );
}
