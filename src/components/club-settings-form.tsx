"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clubSettings, type ClubSettings } from "@/lib/club-settings";
import { api, errMsg } from "@/lib/client";
import { useToast } from "./toast";

export function ClubSettingsForm({ initial }: { initial: ClubSettings }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const identity = [
    ["nombre", "Nombre del club", "Como figura en el estatuto."],
    ["cuit", "CUIT", ""],
    ["directorMedico", "Director médico", "Nombre y matrícula."],
    ["responsableTecnico", "Responsable técnico", "Nombre y matrícula."],
    ["reprocannNumber", "Número REPROCANN del club", ""],
    ["reprocannCode", "Código de vinculación", "El que usan los socios para vincularse."],
  ] as const;
  const limits = [
    ["limiteDiarioG", "Tope diario por socio (g)"],
    ["limiteMensualG", "Tope mensual por socio (g)"],
    ["edadMinima", "Edad mínima para asociarse"],
    ["edadLimiteMenor", "Tope reducido por debajo de (años)"],
    ["limiteMenorG", "Tope mensual reducido (g)"],
    ["thcMaxMenor", "THC máximo con tope reducido (%)"],
    ["maxSocios", "Cupo de socios"],
  ] as const;
  const money = [
    ["aportePorGramo", "Aporte de cultivo por gramo ($)"],
    ["cuotaSocialArs", "Cuota social mensual ($)"],
    ["cuotaIngresoArs", "Cuota de ingreso ($), opcional"],
  ] as const;

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = new FormData(e.currentTarget);
        const values: Record<string, unknown> = {};
        for (const [key] of identity) values[key] = String(form.get(key) ?? "");
        for (const [key] of limits) values[key] = key === "thcMaxMenor" && form.get(key) === "" ? null : Number(String(form.get(key)).replace(",", "."));
        for (const [key] of money) values[key] = form.get(key) === "" ? null : Number(String(form.get(key)).replace(",", "."));
        values.requiereReprocann = form.get("requiereReprocann") === "on";
        const parsed = clubSettings.safeParse(values);
        setError(null);
        if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
        setBusy(true);
        try {
          await api("/api/club", { method: "PATCH", body: parsed.data });
          toast({ tone: "ok", title: "Configuración guardada", text: "Rige para las próximas entregas; las anteriores conservan sus reglas." });
          router.refresh();
        } catch (err) {
          setError(errMsg(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="stack">
        <section className="panel">
          <div className="panel-head"><div><h2 className="panel-title">Identidad legal</h2><p className="panel-sub">Datos reales del club: aparecen en los libros. Podés guardar y completar después.</p></div></div>
          <div className="panel-body field-row">
            {identity.map(([key, label, hint]) => (
              <div key={key}>
                <label className="label" htmlFor={`c-${key}`}>{label}</label>
                <input className="input" id={`c-${key}`} name={key} defaultValue={initial[key]} required={key === "nombre"} maxLength={key === "cuit" ? 20 : 120} />
                {hint ? <span className="hint">{hint}</span> : null}
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><div><h2 className="panel-title">Cuotas y aportes</h2><p className="panel-sub">Es el prorrateo de los costos del club, no un precio: la app lo llama aporte de cultivo y cuota social. Un aporte por gramo convierte el estimado del portal en un cargo real en la cuenta del socio.</p></div></div>
          <div className="panel-body field-row">
            {money.map(([key, label]) => (
              <div key={key}>
                <label className="label" htmlFor={`c-${key}`}>{label}</label>
                <input className="input tnum" id={`c-${key}`} name={key} inputMode="decimal" defaultValue={initial[key] ?? ""} placeholder="0" />
                {key === "aportePorGramo" ? <span className="hint">Sin valor: la entrega no genera cargo.</span> : null}
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><div><h2 className="panel-title">Reglas de entrega</h2><p className="panel-sub">Usá los topes que el club confirmó por escrito. El dispensario los aplica en cada entrega y los deja congelados en el registro.</p></div></div>
          <div className="panel-body field-row">
            {limits.map(([key, label]) => (
              <div key={key}>
                <label className="label" htmlFor={`c-${key}`}>{label}</label>
                <input className="input tnum" id={`c-${key}`} name={key} inputMode="decimal" defaultValue={initial[key] ?? ""} required={key !== "thcMaxMenor"} />
                {key === "thcMaxMenor" ? <span className="hint">Vacío: sin tope de THC adicional.</span> : null}
              </div>
            ))}
            <label className="check" style={{ gridColumn: "1 / -1" }}>
              <input type="checkbox" name="requiereReprocann" defaultChecked={initial.requiereReprocann} />
              <span>Exigir REPROCANN vigente para entregar<span className="hint">Si lo desactivás, el dispensario entrega aunque el REPROCANN esté vencido. No recomendado.</span></span>
            </label>
          </div>
        </section>
      </fieldset>
      {error ? <div className="note note-danger" role="alert">{error}</div> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-lg" disabled={busy}>{busy ? "Guardando…" : "Guardar configuración"}</button>
        <span className="hint" style={{ margin: 0 }}>Cada cambio queda en la actividad del club.</span>
      </div>
    </form>
  );
}
