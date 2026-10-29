"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { Panel } from "@/components/ui";
import { useToast } from "@/components/toast";
import { DATOS_LEGALES, type DatoLegal } from "@/lib/datos-legales";

type Valores = Record<DatoLegal["campo"], string>;

/**
 * Box de datos legales: lo que sólo el club puede declarar. Se completa una vez y alimenta
 * los libros, el informe semestral y la inspección. El recordatorio de arriba muestra qué falta.
 */
export function DatosLegalesForm({ initial }: { initial: Valores }) {
  const router = useRouter();
  const toast = useToast();
  const [valores, setValores] = useState<Valores>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const faltan = DATOS_LEGALES.filter((d) => !valores[d.campo]?.trim());
  const grupos: { titulo: string; campos: DatoLegal["campo"][] }[] = [
    { titulo: "Institución", campos: ["nombre", "cuit", "personeria", "reps", "domicilioLegal"] },
    { titulo: "Inscripción para cultivar", campos: ["reprocannNumber"] },
    { titulo: "Responsables (Res. 1780/2025)", campos: ["directorMedico", "directorMedicoMatricula", "responsableTecnico", "responsableTecnicoTitulo"] },
  ];

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/club", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valores),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message ?? "No pudimos guardar los datos legales.");
      toast({ tone: "ok", title: "Datos legales guardados", text: "Ya salen en los libros y en el informe semestral." });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar los datos legales.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={guardar}>
      {faltan.length ? (
        <div className="note note-warn" role="status">
          <TriangleAlert aria-hidden />
          <div>
            <b>{faltan.length === 1 ? "Falta un dato legal" : `Faltan ${faltan.length} datos legales`}.</b>{" "}
            Sin esto, los libros y el informe semestral salen incompletos. Se completan una sola vez:{" "}
            {faltan.map((f) => f.label.toLowerCase()).join(", ")}.
          </div>
        </div>
      ) : (
        <div className="note" role="status">
          <CheckCircle2 aria-hidden />
          <div>Los datos legales están completos. Así salen los libros y el informe semestral.</div>
        </div>
      )}

      {error && <p className="note note-danger">{error}</p>}

      {grupos.map((g) => (
        <Panel key={g.titulo} title={g.titulo}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            {g.campos.map((campo) => {
              const dato = DATOS_LEGALES.find((d) => d.campo === campo)!;
              return (
                <label key={campo} className="label">
                  {dato.label}
                  <input
                    className="input"
                    value={valores[campo] ?? ""}
                    onChange={(e) => setValores({ ...valores, [campo]: e.target.value })}
                    placeholder={dato.para}
                    autoComplete="off"
                    aria-invalid={!valores[campo]?.trim() || undefined}
                    style={
                      valores[campo]?.trim()
                        ? undefined
                        : { borderColor: "var(--warn, #c98a00)", background: "color-mix(in srgb, var(--warn, #c98a00) 6%, transparent)" }
                    }
                  />
                  <small className="muted" style={{ fontSize: 11.5 }}>
                    {valores[campo]?.trim() ? `Se usa para: ${dato.para.toLowerCase()}` : `Falta · se usa para ${dato.para.toLowerCase()}`}
                  </small>
                </label>
              );
            })}
          </div>
        </Panel>
      ))}

      <div>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Guardando…" : "Guardar datos legales"}
        </button>
      </div>
    </form>
  );
}
