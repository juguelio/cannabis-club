"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api } from "@/lib/client";

export type CobroInicial = {
  alias: string;
  cbu: string;
  titular: string;
  banco: string;
  nota: string;
};

/**
 * Datos para transferir el aporte. El club los carga porque cambian sin tocar código: sin alias ni CBU
 * el portal no puede decirle al socio a dónde mandar la plata.
 */
export function CobroForm({ initial }: { initial: CobroInicial }) {
  const router = useRouter();
  const toast = useToast();
  const [c, setC] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof CobroInicial, v: string) => setC((prev) => ({ ...prev, [k]: v }));

  async function guardar() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/club", {
        method: "PATCH",
        body: {
          cobro: {
            alias: c.alias.trim(),
            cbu: c.cbu.trim(),
            titular: c.titular.trim(),
            banco: c.banco.trim(),
            nota: c.nota.trim(),
          },
        },
      });
      toast({ tone: "ok", title: "Datos de cobro guardados", text: "El portal ya los muestra en cada pedido." });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar los datos de cobro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Datos de cobro"
      subtitle="A dónde transfiere el socio el aporte. Se muestra en el portal junto al monto y el socio sube el comprobante."
    >
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <label className="field">
          <span>Alias</span>
          <input className="input" value={c.alias} onChange={(e) => set("alias", e.target.value)} placeholder="club.aportes" />
        </label>
        <label className="field">
          <span>CBU (22 dígitos)</span>
          <input className="input tnum" value={c.cbu} onChange={(e) => set("cbu", e.target.value)} placeholder="0000000000000000000000" />
        </label>
        <label className="field">
          <span>Titular de la cuenta</span>
          <input className="input" value={c.titular} onChange={(e) => set("titular", e.target.value)} placeholder="Asociación Civil…" />
        </label>
        <label className="field">
          <span>Banco</span>
          <input className="input" value={c.banco} onChange={(e) => set("banco", e.target.value)} placeholder="Banco…" />
        </label>
      </div>
      <label className="field" style={{ marginTop: 12 }}>
        <span>Nota para el socio (opcional)</span>
        <input
          className="input"
          value={c.nota}
          onChange={(e) => set("nota", e.target.value)}
          placeholder="Ej. transferí antes del mediodía y subí el comprobante el mismo día"
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="panel-foot">
        <span className="cell-meta">El socio nunca ve los datos de otros: sólo el alias y el CBU del club.</span>
        <button className="btn" type="button" disabled={busy} onClick={guardar}>
          {busy ? "Guardando…" : "Guardar datos de cobro"}
        </button>
      </div>
    </Panel>
  );
}
