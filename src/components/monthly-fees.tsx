"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";
import { useToast } from "@/components/toast";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function MonthlyFees({ period, cuota }: { period: string; cuota: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ created: number; skipped: number; cuota: number; reason: string | null }>("/api/account/monthly", {
        body: { period },
      });
      if (res.reason) setError(res.reason);
      else toast({ tone: "ok", title: "Cuotas generadas", text: `${res.created} nuevas · ${res.skipped} ya estaban (${MONEY.format(res.cuota)} cada una).` });
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <p style={{ margin: 0 }}>
        {cuota > 0
          ? `Cuota social configurada: ${MONEY.format(cuota)} por mes. Generar el período ${period} cobra una sola vez por socio activo.`
          : "El club no tiene cuota social configurada todavía: cargala en Configuración para poder generarla."}
      </p>
      {error ? <div className="note note-warn">{error}</div> : null}
      <div>
        <button className="btn btn-sm" onClick={run} disabled={busy || cuota <= 0}>
          {busy ? "Generando…" : `Generar cuotas de ${period}`}
        </button>
      </div>
    </div>
  );
}
