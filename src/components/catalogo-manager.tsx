"use client";

import { ValidatedForm, Input, type FormSubmission, type ReportFields } from "./validated-form";

import { ApiError } from "@/lib/client";

import { useCallback, useEffect, useState } from "react";
import { Leaf, Plus, Trash2, Upload } from "lucide-react";
import { Chip, Panel } from "@/components/ui";

type Strain = {
  id: string;
  name: string;
  genetics: string | null;
  thcPct: string | number | null;
  cbdPct: string | number | null;
  active: boolean;
  fotoVersion: number;
};

const MAX = 3 * 1024 * 1024;
const MIMES = ["image/jpeg", "image/png", "image/webp"];
const num = (v: string | number | null) => (v == null ? "" : String(Number(v)));

/**
 * Catálogo del club: cada variedad con su foto. La foto es lo que ve el socio en el portal y
 * el visitante en el sitio; sin foto se muestra un recuadro provisorio, nunca un hueco.
 */
export function CatalogoManager() {
  const [strains, setStrains] = useState<Strain[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [erroresFoto, setErroresFoto] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [nueva, setNueva] = useState({ name: "", genetics: "", thcPct: "", cbdPct: "" });
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    const r = await fetch("/api/strains?todos=1");
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return setError(data.message ?? "No pudimos leer el catálogo.");
    setStrains(data.strains as Strain[]);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(t);
  }, [cargar]);

  async function subirFoto(id: string, file: File | undefined) {
    if (!file) return;
    setError(null);
    setAviso(null);
    const errorFoto = (mensaje: string) => setErroresFoto(prev => ({ ...prev, [id]: mensaje }));
    errorFoto("");
    if (file.size > MAX) return errorFoto("La foto supera los 3 MB.");
    if (!MIMES.includes(file.type)) return errorFoto("La foto tiene que ser JPG, PNG o WEBP.");
    setSubiendo(id);
    try {
      const r = await fetch(`/api/strains/${id}/foto`, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message ?? "No pudimos subir la foto.");
      setAviso("Foto actualizada. El sitio y el portal ya la muestran.");
      await cargar();
    } catch (err) {
      errorFoto(err instanceof Error ? err.message : "No pudimos subir la foto.");
    } finally {
      setSubiendo(null);
    }
  }

  async function quitarFoto(id: string) {
    setError(null);
    setSubiendo(id);
    try {
      const r = await fetch(`/api/strains/${id}/foto`, { method: "DELETE" });
      if (!r.ok) throw new Error("No pudimos quitar la foto.");
      setAviso("Foto quitada: vuelve el recuadro provisorio.");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos quitar la foto.");
    } finally {
      setSubiendo(null);
    }
  }

  async function guardar(s: Strain, cambios: Partial<{ name: string; genetics: string | null; thcPct: number | null; cbdPct: number | null; active: boolean }>) {
    setError(null);
    try {
      const r = await fetch(`/api/strains/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message ?? "No pudimos guardar los cambios.");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar los cambios.");
    }
  }

  async function crear(_: FormSubmission, reportFields: ReportFields) {
    setError(null);
    setAviso(null);
    setCreando(true);
    try {
      const r = await fetch("/api/strains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nueva.name,
          genetics: nueva.genetics || undefined,
          thcPct: nueva.thcPct ? Number(nueva.thcPct) : undefined,
          cbdPct: nueva.cbdPct ? Number(nueva.cbdPct) : undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new ApiError(data.error, data.message ?? "No pudimos crear la variedad.", r.status, data.details);
      setNueva({ name: "", genetics: "", thcPct: "", cbdPct: "" });
      setAviso("Variedad creada. Ahora subile la foto.");
      await cargar();
    } catch (err) {
      if (!reportFields(err)) setError(err instanceof Error ? err.message : "No pudimos crear la variedad.");
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Panel title="Catálogo del club" subtitle="Cada variedad con su foto. Lo que se ve acá es lo que aparece en el sitio y en el portal del socio.">
        {error && <p className="note note-danger">{error}</p>}
        {aviso && <p className="note">{aviso}</p>}
        {strains === null ? (
          <p className="muted">Cargando…</p>
        ) : strains.length === 0 ? (
          <p className="muted">Todavía no hay variedades. Creá la primera abajo.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {strains.map((s) => (
              <div key={s.id} style={{ border: `1px ${s.active ? "solid" : "dashed"} var(--line)`, borderRadius: 12, overflow: "hidden", opacity: s.active ? 1 : 0.7 }}>
                {s.fotoVersion > 0 ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`/api/variedades/${s.id}/foto?v=${s.fotoVersion}&w=480`}
                    alt={s.name}
                    loading="lazy"
                    decoding="async"
                    style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block", borderBottom: "1px solid var(--line)" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%", aspectRatio: "4 / 3", display: "grid", placeItems: "center", gap: 6,
                      background: "var(--mist, #f2f4f2)", borderBottom: "1px solid var(--line)",
                    }}
                  >
                    <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
                      <Leaf aria-hidden style={{ width: 26, height: 26 }} />
                      <small style={{ fontSize: 11.5 }}>Foto provisoria</small>
                    </div>
                  </div>
                )}

                <div className="stack" style={{ padding: 12, gap: 8 }}>
                  <div className="flex items-center justify-between gap-2">
                    <b style={{ fontSize: 15 }}>{s.name}</b>
                    <Chip tone={s.active ? "ok" : "mute"}>{s.active ? "Publicada" : "Apagada"}</Chip>
                  </div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {[s.genetics, s.thcPct != null ? `THC ${num(s.thcPct)}%` : null, s.cbdPct != null ? `CBD ${num(s.cbdPct)}%` : null]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos de la variedad"}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="btn btn-sm btn-quiet" style={{ cursor: subiendo === s.id ? "progress" : "pointer", display: "inline-flex" }}>
                      <Upload aria-hidden style={{ width: 15, height: 15 }} />
                      {subiendo === s.id ? "Subiendo…" : s.fotoVersion > 0 ? "Cambiar foto" : "Subir foto"}
                      <input
                        type="file"
                        aria-invalid={erroresFoto[s.id] ? true : undefined}
                        aria-describedby={erroresFoto[s.id] ? `foto-error-${s.id}` : undefined}
                        accept={MIMES.join(",")}
                        disabled={subiendo === s.id}
                        onChange={(e) => subirFoto(s.id, e.target.files?.[0])}
                        style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}
                        aria-label={`${s.fotoVersion > 0 ? "Cambiar" : "Subir"} foto de ${s.name}`}
                      />
                    </label>
                    {erroresFoto[s.id] && <small className="field-error" role="alert" id={`foto-error-${s.id}`}>{erroresFoto[s.id]}</small>}
                    {s.fotoVersion > 0 ? (
                      <button className="btn btn-sm btn-ghost" type="button" onClick={() => quitarFoto(s.id)} disabled={subiendo === s.id}>
                        <Trash2 aria-hidden style={{ width: 15, height: 15 }} />
                        Quitar
                      </button>
                    ) : null}
                    <button
                      className="btn btn-sm btn-ghost"
                      type="button"
                      onClick={() => guardar(s, { active: !s.active })}
                      title={s.active ? "Dejar de mostrarla en el catálogo" : "Volver a mostrarla"}
                    >
                      {s.active ? "Apagar" : "Publicar"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Agregar variedad" subtitle="Nombre y, si los sabés, genética y porcentajes. La foto se sube después.">
        <ValidatedForm className="stack" onSubmit={crear}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <label className="label">
              Nombre
              <Input className="input" required minLength={2} name="name" value={nueva.name} onChange={(e) => setNueva({ ...nueva, name: e.target.value })} placeholder="Lemon Haze" />
            </label>
            <label className="label">
              Genética
              <Input className="input" name="genetics" value={nueva.genetics} onChange={(e) => setNueva({ ...nueva, genetics: e.target.value })} placeholder="Sativa" />
            </label>
            <label className="label">
              THC %
              <Input className="input" type="number" min={0} max={100} step="0.1" name="thcPct" value={nueva.thcPct} onChange={(e) => setNueva({ ...nueva, thcPct: e.target.value })} />
            </label>
            <label className="label">
              CBD %
              <Input className="input" type="number" min={0} max={100} step="0.1" name="cbdPct" value={nueva.cbdPct} onChange={(e) => setNueva({ ...nueva, cbdPct: e.target.value })} />
            </label>
          </div>
          <div>
            <button className="btn" type="submit" disabled={creando}>
              <Plus aria-hidden style={{ width: 16, height: 16 }} />
              {creando ? "Creando…" : "Crear variedad"}
            </button>
          </div>
        </ValidatedForm>
      </Panel>
    </div>
  );
}
