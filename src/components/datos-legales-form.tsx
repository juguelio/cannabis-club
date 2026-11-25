"use client";

import { ValidatedForm, Input, type ReportFields } from "./validated-form";

import { ApiError } from "@/lib/client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import { Panel } from "@/components/ui";
import { useToast } from "@/components/toast";
import { DATOS_LEGALES, faltantesLegales, valorDeDemo, type DatoLegal } from "@/lib/datos-legales";

type Valores = Record<DatoLegal["campo"], string>;

/** Se agrupa por responsable: la matrícula del director queda al lado de su nombre. */
const GRUPOS: { titulo: string; campos: DatoLegal["campo"][] }[] = [
  { titulo: "Institución", campos: ["nombre", "cuit", "personeria", "reps", "domicilioLegal"] },
  { titulo: "Inscripción para cultivar", campos: ["reprocannNumber"] },
  { titulo: "Director médico", campos: ["directorMedico", "directorMedicoMatricula"] },
  { titulo: "Responsable técnico", campos: ["responsableTecnico", "responsableTecnicoTitulo"] },
];

/** Los datos largos usan dos columnas para que no queden apretados. */
const ANCHOS: Partial<Record<DatoLegal["campo"], string>> = { domicilioLegal: "span 2", personeria: "span 2" };

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

  // Mismo criterio que el recordatorio del panel: vacío o todavía con el valor de la demo.
  const faltan = faltantesLegales(valores);
  const completos = DATOS_LEGALES.length - faltan.length;

  async function guardar(e: React.FormEvent, reportFields: ReportFields) {
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
      if (!r.ok) throw new ApiError(data.error, data.message ?? "No pudimos guardar los datos legales.", r.status, data.details);
      toast({ tone: "ok", title: "Datos legales guardados", text: "Ya salen en los libros y en el informe semestral." });
      router.refresh();
    } catch (err) {
      if (!reportFields(err)) setError(err instanceof Error ? err.message : "No pudimos guardar los datos legales.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ValidatedForm className="stack" onSubmit={guardar}>
      {faltan.length ? (
        <div className="note note-warn" role="status">
          <TriangleAlert aria-hidden />
          <div>
            <b>
              {completos} de {DATOS_LEGALES.length} datos legales completos.
            </b>{" "}
            {faltan.length === 1 ? "Falta uno" : `Faltan ${faltan.length}`}: {faltan.map((f) => f.label).join(", ")}.
            Se completan una sola vez y quedan en los libros y en el informe semestral.
          </div>
        </div>
      ) : (
        <div className="note" role="status">
          <CheckCircle2 aria-hidden />
          <div>Los datos legales están completos. Así salen los libros y el informe semestral.</div>
        </div>
      )}

      {error && <p className="note note-danger">{error}</p>}

      {GRUPOS.map((g) => (
        <Panel key={g.titulo} title={g.titulo}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            {g.campos.map((campo) => {
              const dato = DATOS_LEGALES.find((d) => d.campo === campo)!;
              const valor = valores[campo] ?? "";
              const esDemo = valorDeDemo(valor);
              const pendiente = !valor.trim() || esDemo;
              return (
                <label key={campo} className="label" style={{ gridColumn: ANCHOS[campo] }}>
                  {dato.label}
                  <Input
                    className="input"
                    name={campo} value={valor}
                    onChange={(e) => setValores({ ...valores, [campo]: e.target.value })}
                    placeholder={dato.ejemplo}
                    autoComplete="off"
                    aria-invalid={pendiente || undefined}
                    style={
                      pendiente
                        ? { borderColor: "var(--warn, #c98a00)", background: "color-mix(in srgb, var(--warn, #c98a00) 6%, transparent)" }
                        : undefined
                    }
                  />
                  <small className="muted" style={{ fontSize: 11.5 }}>
                    {esDemo ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--warn, #c98a00)" }}>
                        <CircleAlert aria-hidden style={{ width: 12, height: 12 }} />
                        Valor de ejemplo: reemplazalo por el del club
                      </span>
                    ) : !valor.trim() ? (
                      `Falta · se usa para ${dato.para.toLowerCase()}`
                    ) : (
                      `Se usa para: ${dato.para.toLowerCase()}`
                    )}
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
    </ValidatedForm>
  );
}
