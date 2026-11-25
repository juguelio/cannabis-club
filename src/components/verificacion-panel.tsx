"use client";

import { ValidatedForm, Input, type FormSubmission, type ReportFields } from "./validated-form";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";
import { useToast } from "@/components/toast";

type DocMeta = { id: string; tipo: string; size: number; subido: string };

export type VerificacionEstado = {
  estado: "PENDIENTE" | "EN_REVISION" | "VERIFICADO" | "RECHAZADO";
  label: string;
  detalle: string;
  motivoRechazo: string | null;
  presentacion: {
    id: string;
    enviada: string;
    documentos: DocMeta[];
    entrega?: "RETIRO" | "ENVIO";
    domicilio?: {
      direccion: string | null;
      localidad: string | null;
      provincia: string | null;
      codigoPostal: string | null;
    };
  } | null;
  faltan: string[];
  faltantesTexto: string;
  legajo: { numero: number; docLast4: string | null; venceReprocann: string | null };
};

const DOCS: { tipo: "DNI_FRENTE" | "DNI_DORSO" | "REPROCANN"; label: string; ayuda: string }[] = [
  { tipo: "DNI_FRENTE", label: "DNI — frente", ayuda: "Donde está tu foto y tu número." },
  { tipo: "DNI_DORSO", label: "DNI — dorso", ayuda: "Donde está el código de barras." },
  { tipo: "REPROCANN", label: "Credencial del REPROCANN", ayuda: "La que te dio el registro, con su vencimiento." },
];

const fmtVence = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "sin declarar");

/**
 * Trámite de re-validación del socio. Dos pasos y se puede rehacer si el club pide corregir:
 * primero los datos, después los tres archivos. Nada de esto se guarda sin cifrar.
 */
export function VerificacionPanel({ inicial }: { inicial: VerificacionEstado }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    dni: "",
    nacimiento: "",
    reprocann: "",
    vence: "",
    // Cómo recibe: se pregunta acá porque es cuando ya está escribiendo, y sin localidad y CP no hay envío.
    entrega: (inicial.presentacion?.entrega ?? "RETIRO") as "RETIRO" | "ENVIO",
    direccion: inicial.presentacion?.domicilio?.direccion ?? "",
    localidad: inicial.presentacion?.domicilio?.localidad ?? "",
    provincia: inicial.presentacion?.domicilio?.provincia ?? "",
    codigoPostal: inicial.presentacion?.domicilio?.codigoPostal ?? "",
  });
  const [estado, setEstado] = useState(inicial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subidos, setSubidos] = useState<Record<string, string>>(
    Object.fromEntries((inicial.presentacion?.documentos ?? []).map((d) => [d.tipo, d.subido])),
  );
  const [, startTransition] = useTransition();
  const [docConError, setDocConError] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const tienePresentacion = !!estado.presentacion;
  const faltan = DOCS.map((d) => d.tipo).filter((t) => !subidos[t]);

  async function guardarDatos(_: FormSubmission, reportFields: ReportFields) {
    setBusy("datos");
    setDocConError(null);
    setError(null);
    try {
      await api("/api/portal/verificacion", { body: form });
      toast({ tone: "ok", title: "Datos guardados", text: "Ahora subí las tres fotos." });
      const r = await fetch("/api/portal/verificacion").then((res) => res.json());
      setEstado((prev) => ({ ...prev, ...r, presentacion: r.presentacion ?? prev.presentacion }));
      startTransition(() => router.refresh());
    } catch (err) {
      if (!reportFields(err)) setError(errMsg(err));
    } finally {
      setBusy(null);
    }
  }

  async function subirDoc(tipo: string) {
    const file = inputs.current[tipo]?.files?.[0];
    if (!file) return;
    setBusy(tipo);
    setDocConError(tipo);
    setError(null);
    try {
      const res = await fetch(`/api/portal/verificacion/documentos?tipo=${tipo}`, {
        method: "POST",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? "No pudimos subir el archivo.");
      }
      setSubidos((s) => ({ ...s, [tipo]: new Date().toISOString() }));
      toast({ tone: "ok", title: "Archivo recibido", text: DOCS.find((d) => d.tipo === tipo)?.label });
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos subir el archivo.");
    } finally {
      setBusy(null);
      const el = inputs.current[tipo];
      if (el) el.value = "";
    }
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="note note-warn">
        <div>
          <b>{estado.label}.</b> {estado.detalle}
          {estado.estado === "RECHAZADO" && estado.motivoRechazo ? ` Motivo del club: «${estado.motivoRechazo}».` : ""}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h3 className="panel-title">Paso 1 · Tus datos</h3>
            <p className="panel-sub">
              El número de DNI no se guarda en claro: se guarda una huella y los últimos cuatro dígitos para
              verificarte en el mostrador.
            </p>
          </div>
        </div>

        <ValidatedForm onSubmit={guardarDatos} className="stack" style={{ gap: 14 }}>
          <div className="grid-2">
            <label className="stack" style={{ gap: 6 }}>
              <span className="label">DNI</span>
              <Input
                className="input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Sin puntos"
                name="dni" value={form.dni}
                onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))}
                required
              />
            </label>
            <label className="stack" style={{ gap: 6 }}>
              <span className="label">Fecha de nacimiento</span>
              <Input
                className="input"
                type="date"
                name="nacimiento" value={form.nacimiento}
                onChange={(e) => setForm((f) => ({ ...f, nacimiento: e.target.value }))}
                required
              />
            </label>
            <label className="stack" style={{ gap: 6 }}>
              <span className="label">Número de REPROCANN</span>
              <Input
                className="input"
                autoComplete="off"
                name="reprocann" value={form.reprocann}
                onChange={(e) => setForm((f) => ({ ...f, reprocann: e.target.value }))}
                required
              />
            </label>
            <label className="stack" style={{ gap: 6 }}>
              <span className="label">Vence el</span>
              <Input
                className="input"
                type="date"
                name="vence" value={form.vence}
                onChange={(e) => setForm((f) => ({ ...f, vence: e.target.value }))}
                required
              />
            </label>
          </div>
          <div>
            <span className="label">¿Cómo recibís el producto?</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Forma de entrega">
              {([
                { id: "RETIRO" as const, t: "Retiro en el club", d: "En la sede, con turno." },
                { id: "ENVIO" as const, t: "Envío a domicilio", d: "Al domicilio que declares acá." },
              ]).map((op) => (
                <button
                  key={op.id}
                  type="button"
                  className="btn btn-quiet"
                  aria-pressed={form.entrega === op.id}
                  onClick={() => setForm((f) => ({ ...f, entrega: op.id }))}
                  style={
                    form.entrega === op.id
                      ? { borderColor: "var(--ink)", boxShadow: "inset 0 0 0 1px var(--ink)", textAlign: "left" }
                      : { textAlign: "left", opacity: 0.75 }
                  }
                >
                  <span style={{ display: "block", fontWeight: 650 }}>{op.t}</span>
                  <span className="cell-meta">{op.d}</span>
                </button>
              ))}
            </div>
          </div>

          {form.entrega === "ENVIO" ? (
            <div className="grid-2">
              <label className="stack" style={{ gap: 6, gridColumn: "1 / -1" }}>
                <span className="label">Calle y número</span>
                <Input
                  className="input"
                  autoComplete="street-address"
                  placeholder="Ej. Tromen 120, casa 9"
                  name="direccion" value={form.direccion}
                  onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                  required
                />
              </label>
              <label className="stack" style={{ gap: 6 }}>
                <span className="label">Localidad</span>
                <Input
                  className="input"
                  autoComplete="address-level2"
                  name="localidad" value={form.localidad}
                  onChange={(e) => setForm((f) => ({ ...f, localidad: e.target.value }))}
                  required
                />
              </label>
              <label className="stack" style={{ gap: 6 }}>
                <span className="label">Provincia</span>
                <Input
                  className="input"
                  autoComplete="address-level1"
                  placeholder="Ej. Neuquén"
                  name="provincia" value={form.provincia}
                  onChange={(e) => setForm((f) => ({ ...f, provincia: e.target.value }))}
                  required
                />
              </label>
              <label className="stack" style={{ gap: 6 }}>
                <span className="label">Código postal</span>
                <Input
                  className="input"
                  autoComplete="postal-code"
                  inputMode="numeric"
                  placeholder="Ej. 8370"
                  maxLength={8}
                  name="codigoPostal" value={form.codigoPostal}
                  onChange={(e) => setForm((f) => ({ ...f, codigoPostal: e.target.value }))}
                  required
                />
              </label>
            </div>
          ) : null}

          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn" disabled={busy === "datos"}>
              {busy === "datos" ? "Guardando…" : tienePresentacion ? "Corregir y reenviar" : "Guardar datos"}
            </button>
            <span className="hint">El club revisa contra el documento: se tiene que leer bien.</span>
          </div>
        </ValidatedForm>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h3 className="panel-title">Paso 2 · Los archivos</h3>
            <p className="panel-sub">
              Foto o PDF de cada uno, hasta 6 MB. Se guardan cifrados y sólo los abre un administrador: cada
              apertura queda registrada.
            </p>
          </div>
        </div>

        {!tienePresentacion ? (
          <p className="cell-meta">Primero guardá tus datos: los archivos se cuelgan de esa presentación.</p>
        ) : (
          <ul className="rows">
            {DOCS.map((d) => {
              const ok = !!subidos[d.tipo];
              return (
                <li key={d.tipo} className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="cell-main">
                      {d.label} {ok ? <span className="chip chip-ok">Recibido</span> : <span className="chip chip-warn">Falta</span>}
                    </div>
                    <div className="cell-meta">{d.ayuda}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="btn btn-quiet btn-sm" style={{ cursor: "pointer" }}>
                      {ok ? "Reemplazar" : "Subir"}
                      <input
                        ref={(el) => {
                          inputs.current[d.tipo] = el;
                        }}
                        aria-label={`${ok ? "Reemplazar" : "Subir"} ${d.label}`}
                        aria-invalid={docConError === d.tipo && error ? true : undefined}
                        aria-describedby={docConError === d.tipo && error ? `doc-error-${d.tipo}` : undefined}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                        onChange={() => void subirDoc(d.tipo)}
                      />
                    </label>
                    {docConError === d.tipo && error && <small role="alert" id={`doc-error-${d.tipo}`} className="field-error">{error}</small>}
                    {busy === d.tipo ? <span className="cell-meta">Subiendo…</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {tienePresentacion && faltan.length === 0 ? (
          <div className="note" style={{ marginTop: 12 }}>
            <div>
              Listo: están los tres archivos. El club revisa tu legajo y te habilita para pedir. Si algo no se lee, te
              lo devuelve con el motivo.
            </div>
          </div>
        ) : null}
      </div>

      {error && !docConError ? (
        <div className="note note-danger" role="alert">
          <div>{error}</div>
        </div>
      ) : null}

      <p className="cell-meta">
        Legajo {estado.legajo.numero} · DNI {estado.legajo.docLast4 ? `····${estado.legajo.docLast4}` : "sin verificar"} ·
        REPROCANN {fmtVence(estado.legajo.venceReprocann)}
      </p>
    </div>
  );
}
