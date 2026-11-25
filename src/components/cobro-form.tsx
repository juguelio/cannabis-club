"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ValidatedForm, Input, type FormSubmission, type ReportFields } from "./validated-form";
import { Panel } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api } from "@/lib/client";

import { clubSettingsFields } from "@/lib/club-settings";

const cobroSchema = clubSettingsFields.pick({ cobro: true });

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar({ values }: FormSubmission, reportFields: ReportFields) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/club", {
        method: "PATCH",
        body: values,
      });
      toast({ tone: "ok", title: "Datos de cobro guardados", text: "El portal ya los muestra en cada pedido." });
      router.refresh();
    } catch (err) {
      if (!reportFields(err)) setError(err instanceof Error ? err.message : "No pudimos guardar los datos de cobro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ValidatedForm schema={cobroSchema} onSubmit={guardar}>
    <Panel
      title="Datos de cobro"
      subtitle="A dónde transfiere el socio el aporte. Se muestra en el portal junto al monto y el socio sube el comprobante."
    >
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <label className="field">
          <span>Alias</span>
          <Input className="input" name="cobro.alias" defaultValue={initial.alias} placeholder="republica.ong" />
        </label>
        <label className="field">
          <span>CBU (22 dígitos)</span>
          <Input className="input tnum" name="cobro.cbu" defaultValue={initial.cbu} placeholder="0000000000000000000000" />
        </label>
        <label className="field">
          <span>Titular de la cuenta</span>
          <Input className="input" name="cobro.titular" defaultValue={initial.titular} placeholder="Asociación Civil…" />
        </label>
        <label className="field">
          <span>Banco</span>
          <Input className="input" name="cobro.banco" defaultValue={initial.banco} placeholder="Banco…" />
        </label>
      </div>
      <label className="field" style={{ marginTop: 12 }}>
        <span>Nota para el socio (opcional)</span>
        <Input
          className="input"
          name="cobro.nota" defaultValue={initial.nota}
          placeholder="Ej. transferí antes del mediodía y subí el comprobante el mismo día"
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="panel-foot">
        <span className="cell-meta">El socio nunca ve los datos de otros: sólo el alias y el CBU del club.</span>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Guardando…" : "Guardar datos de cobro"}
        </button>
      </div>
    </Panel>
    </ValidatedForm>
  );
}
