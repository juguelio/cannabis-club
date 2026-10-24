"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clubSettings, type ClubSettings } from "@/lib/club-settings";
import { Section } from "./ui";

export function ClubSettingsForm({ initial }: { initial: ClubSettings }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const identity = [["nombre", "Nombre del club"], ["cuit", "CUIT"], ["directorMedico", "Director médico"], ["responsableTecnico", "Responsable técnico"], ["reprocannNumber", "Número REPROCANN"], ["reprocannCode", "Código de vinculación"]] as const;
  const limits = [["limiteDiarioG", "Tope diario (g)"], ["limiteMensualG", "Tope mensual (g)"], ["limiteMenorG", "Tope mensual para menores (g)"], ["edadMinima", "Edad mínima"], ["edadLimiteMenor", "Menor de esta edad"], ["thcMaxMenor", "THC máximo para menores (%)"], ["maxSocios", "Capacidad de socios"]] as const;
  return <form className="space-y-5" onSubmit={async e => {
    e.preventDefault(); if (busy) return;
    const form = new FormData(e.currentTarget);
    const values: Record<string, unknown> = Object.fromEntries(form);
    for (const [key] of limits) values[key] = key === "thcMaxMenor" && form.get(key) === "" ? null : Number(form.get(key));
    values.requiereReprocann = form.get("requiereReprocann") === "on";
    const parsed = clubSettings.safeParse(values);
    setMessage(""); setError(false);
    if (!parsed.success) { setError(true); setMessage(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/club", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "No se pudieron guardar los cambios.");
      setMessage("Configuración guardada. Se aplicará a las próximas entregas."); router.refresh();
    } catch (err) { setError(true); setMessage(err instanceof Error ? err.message : "No se pudo conectar. Intentá nuevamente."); }
    finally { setBusy(false); }
  }}>
    <fieldset disabled={busy} className="space-y-5">
      <Section title="01 · Identidad de la asociación" subtitle="Completá los datos reales del club. Podés guardar y continuar más tarde.">
        <div className="grid gap-4 sm:grid-cols-2 p-5">{identity.map(([key, label]) => <label key={key} className="label">{label}<input className="input mt-2" name={key} defaultValue={initial[key]} required={key === "nombre"} maxLength={key === "cuit" ? 20 : key.startsWith("reprocann") ? 100 : 120} /></label>)}</div>
      </Section>
      <Section title="02 · Reglas de entrega" subtitle="Usá los topes confirmados por la coordinación del club.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 p-5">{limits.map(([key, label]) => <label key={key} className="label">{label}<input className="input mt-2" type="number" name={key} defaultValue={initial[key] ?? ""} min={key.startsWith("edad") ? 18 : key === "maxSocios" ? 1 : key === "thcMaxMenor" ? 0 : 0.01} step={key.startsWith("edad") || key === "maxSocios" ? 1 : 0.01} required={key !== "thcMaxMenor"} />{key === "thcMaxMenor" && <span className="cell-meta">Vacío = sin tope adicional de THC.</span>}</label>)}</div>
        <label className="flex items-center gap-3 px-5 pb-5 text-sm"><input type="checkbox" name="requiereReprocann" defaultChecked={initial.requiereReprocann} /> Exigir REPROCANN vigente para entregar</label>
      </Section>
    </fieldset>
    <div className="settings-save"><p className="cell-meta">Cada cambio queda registrado. Las entregas anteriores conservan sus reglas.</p><button className="btn" disabled={busy}>{busy ? "Guardando…" : "Guardar configuración"}</button></div>
    {message && <p role={error ? "alert" : "status"} className={`alert ${error ? "alert-danger" : "alert-ok"}`}>{message}</p>}
  </form>;
}
