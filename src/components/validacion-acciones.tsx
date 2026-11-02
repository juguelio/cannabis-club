"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";
import { useToast } from "@/components/toast";

/**
 * Aprobar aplica el documento a la ficha; pedir corrección deja el motivo que el socio va a leer.
 * El botón de aprobar se apaga si faltan archivos: aprobar a ciegas es el error que este trámite evita.
 */
export function ValidacionAcciones({ id, faltantesTexto }: { id: string; faltantesTexto: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<"aprobar" | "rechazar" | null>(null);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const bloqueado = faltantesTexto.length > 0;

  async function decidir(decision: "APROBAR" | "RECHAZAR") {
    setBusy(decision === "APROBAR" ? "aprobar" : "rechazar");
    setError(null);
    try {
      const r = await api(`/api/verificaciones/${id}/decision`, { body: { decision, motivo } });
      toast({ tone: "ok", title: "Listo", text: (r as { mensaje?: string }).mensaje ?? "Revisión resuelta." });
      startTransition(() => router.refresh());
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <button className="btn btn-sm" disabled={busy !== null || bloqueado} onClick={() => void decidir("APROBAR")} title={faltantesTexto || undefined}>
          {busy === "aprobar" ? "Aprobando…" : "Aprobar legajo"}
        </button>
        <button className="btn btn-quiet btn-sm" disabled={busy !== null} onClick={() => setCorrigiendo((v) => !v)}>
          {corrigiendo ? "Cancelar" : "Pedir corrección"}
        </button>
        {bloqueado ? <span className="cell-meta">{faltantesTexto}</span> : null}
      </div>

      {corrigiendo ? (
        <div className="stack" style={{ gap: 6 }}>
          <input
            className="input"
            placeholder="Qué tiene que corregir (mínimo 10 caracteres)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={400}
          />
          <button
            className="btn btn-quiet btn-sm"
            style={{ alignSelf: "flex-start" }}
            disabled={busy !== null || motivo.trim().length < 10}
            onClick={() => void decidir("RECHAZAR")}
          >
            {busy === "rechazar" ? "Enviando…" : "Enviar corrección"}
          </button>
        </div>
      ) : null}

      {error ? <span className="cell-meta" style={{ color: "var(--danger)" }}>{error}</span> : null}
    </div>
  );
}
