"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Eye, Mail, Plus, Send, Trash2 } from "lucide-react";
import { Chip, Note, Panel } from "@/components/ui";

type Bloque = { titulo: string; texto: string; enlaceTexto?: string; enlaceUrl?: string };
type Fila = {
  id: string;
  edicion: string;
  titulo: string;
  copete: string;
  apertura: string[];
  bloques: { titulo: string; texto: string; enlace?: { texto: string; url: string } }[];
  cta?: { texto: string; url: string } | null;
  estado: "BORRADOR" | "APROBADA" | "ENVIANDO" | "ENVIADA" | "CANCELADA";
  programadaPara: string | null;
  enviadaEn: string | null;
  alcanzados: number;
  enviados: number;
  errores: number;
};
type Padron = { total: number; excluidos: number; motivos: Record<string, number> };

const VACIA = { edicion: "", titulo: "", copete: "", apertura: "", ctaTexto: "", ctaUrl: "" };

const TONO: Record<Fila["estado"], "mute" | "warn" | "ok" | "danger"> = {
  BORRADOR: "mute",
  APROBADA: "warn",
  ENVIANDO: "warn",
  ENVIADA: "ok",
  CANCELADA: "danger",
};

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—");

/**
 * La pantalla de cartas: escribir, mirar cómo queda y decidir que salga.
 *
 * El diseño no se edita acá — se edita el texto. La vista previa es la plantilla real: lo que se ve
 * en el recuadro es lo que sale.
 */
export function CartasManager({ cartasIniciales, padron, soloLectura = false }: { cartasIniciales: Fila[]; padron: Padron; soloLectura?: boolean }) {
  const [cartas, setCartas] = useState<Fila[]>(cartasIniciales);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState({ ...VACIA });
  const [bloques, setBloques] = useState<Bloque[]>([{ titulo: "", texto: "" }]);
  const [html, setHtml] = useState<string | null>(null);
  const [faltan, setFaltan] = useState<string[]>([]);

  const recargar = useCallback(async () => {
    const r = await fetch("/api/cartas");
    const data = await r.json().catch(() => ({}));
    if (r.ok) setCartas(data.cartas as Fila[]);
  }, []);

  const cuerpo = useMemo(
    () => ({
      edicion: form.edicion,
      titulo: form.titulo,
      copete: form.copete,
      apertura: form.apertura.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
      bloques: bloques
        .filter((b) => b.titulo.trim() || b.texto.trim())
        .map((b) => ({
          titulo: b.titulo,
          texto: b.texto,
          ...(b.enlaceUrl?.trim() ? { enlace: { texto: b.enlaceTexto || "Ver más", url: b.enlaceUrl } } : {}),
        })),
      ...(form.ctaUrl.trim() ? { cta: { texto: form.ctaTexto || "Entrar al portal", url: form.ctaUrl } } : {}),
    }),
    [form, bloques]
  );

  async function pedir(url: string, metodo = "POST", body?: unknown) {
    setError(null);
    setAviso(null);
    setOcupado(url);
    try {
      const r = await fetch(url, {
        method: metodo,
        ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFaltan(Array.isArray(data.detalle) ? data.detalle : []);
        setError(data.message ?? "No pudimos completar la acción.");
        return null;
      }
      setFaltan([]);
      return data;
    } finally {
      setOcupado(null);
    }
  }

  async function previsualizar() {
    const data = await pedir("/api/cartas/preview", "POST", cuerpo);
    if (data?.html) setHtml(data.html as string);
  }

  async function guardar() {
    const data = editando
      ? await pedir(`/api/cartas/${editando}`, "PATCH", cuerpo)
      : await pedir("/api/cartas", "POST", cuerpo);
    if (!data) return;
    setAviso(editando ? "Borrador actualizado." : "Borrador guardado.");
    setEditando(null);
    setForm({ ...VACIA });
    setBloques([{ titulo: "", texto: "" }]);
    setHtml(null);
    await recargar();
  }

  async function accion(id: string, url: string, confirmacion: string) {
    if (!window.confirm(confirmacion)) return;
    const data = await pedir(url, "POST");
    if (!data) return;
    setAviso(data.mensaje ?? "Listo.");
    await recargar();
  }

  function cargarEnForm(f: Fila) {
    setEditando(f.id);
    setForm({
      edicion: f.edicion,
      titulo: f.titulo,
      copete: f.copete,
      apertura: (f.apertura ?? []).join("\n\n"),
      ctaTexto: f.cta?.texto ?? "",
      ctaUrl: f.cta?.url ?? "",
    });
    setBloques(
      (f.bloques ?? []).map((b) => ({ titulo: b.titulo, texto: b.texto, enlaceTexto: b.enlace?.texto, enlaceUrl: b.enlace?.url }))
    );
    setHtml(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const input = "w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      <Panel title="A quién le llega" subtitle="Sólo socios activos, con email y con consentimiento de comunicaciones.">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Chip tone="ok">{padron.total} socios reciben la carta</Chip>
          <Chip tone="mute">{padron.excluidos} no la reciben</Chip>
          {Object.entries(padron.motivos).map(([motivo, n]) => (
            <span key={motivo} className="text-xs text-[var(--muted-foreground)]">
              {n} × {motivo}
            </span>
          ))}
        </div>
      </Panel>

      {!soloLectura && (
      <Panel
        title={editando ? "Editando un borrador" : "Nueva carta"}
        subtitle="Escribís el texto; el diseño lo pone la plantilla. La vista previa es la real. Al aprobar sale en la próxima pasada del cron (8:15), o enseguida con «Enviar ahora»."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Edición
            <input className={input} placeholder="noviembre 2026" value={form.edicion} onChange={(e) => setForm({ ...form, edicion: e.target.value })} />
          </label>
          <label className="text-sm">
            Título
            <input className={input} placeholder="El mes en que el club se ordena" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </label>
          <label className="text-sm sm:col-span-2">
            Bajada
            <input className={input} placeholder="Una o dos líneas que resuman la carta" value={form.copete} onChange={(e) => setForm({ ...form, copete: e.target.value })} />
          </label>
          <label className="text-sm sm:col-span-2">
            Primeros párrafos <span className="text-[var(--muted-foreground)]">(separá con una línea en blanco)</span>
            <textarea className={`${input} min-h-24`} value={form.apertura} onChange={(e) => setForm({ ...form, apertura: e.target.value })} />
          </label>
        </div>

        <div className="mt-4 space-y-3">
          {bloques.map((b, i) => (
            <div key={i} className="rounded-lg border border-[var(--border)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--muted-foreground)]">Bloque {i + 1}</span>
                <button
                  type="button"
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  onClick={() => setBloques(bloques.filter((_, j) => j !== i))}
                  aria-label={`Quitar bloque ${i + 1}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <input className={input} placeholder="Título del bloque" value={b.titulo} onChange={(e) => setBloques(bloques.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)))} />
              <textarea className={`${input} mt-2 min-h-16`} placeholder="Texto del bloque" value={b.texto} onChange={(e) => setBloques(bloques.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))} />
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input className={input} placeholder="Texto del enlace (opcional)" value={b.enlaceTexto ?? ""} onChange={(e) => setBloques(bloques.map((x, j) => (j === i ? { ...x, enlaceTexto: e.target.value } : x)))} />
                <input className={input} placeholder="https://… (opcional)" value={b.enlaceUrl ?? ""} onChange={(e) => setBloques(bloques.map((x, j) => (j === i ? { ...x, enlaceUrl: e.target.value } : x)))} />
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setBloques([...bloques, { titulo: "", texto: "" }])}>
            <Plus size={14} /> Agregar bloque
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Botón: texto
            <input className={input} placeholder="Entrar al portal del socio" value={form.ctaTexto} onChange={(e) => setForm({ ...form, ctaTexto: e.target.value })} />
          </label>
          <label className="text-sm">
            Botón: dirección
            <input className={input} placeholder="https://republicacannabis.com.ar/portal" value={form.ctaUrl} onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })} />
          </label>
        </div>

        {error && <Note tone="danger">{error}</Note>}
        {faltan.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-sm text-[var(--muted-foreground)]">
            {faltan.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={previsualizar} disabled={ocupado !== null} className="btn btn-sm btn-quiet">
            <Eye size={14} /> Ver vista previa
          </button>
          <button type="button" onClick={guardar} disabled={ocupado !== null} className="btn btn-sm">
            <Check size={14} /> {editando ? "Guardar cambios" : "Guardar borrador"}
          </button>
          {editando && (
            <button type="button" onClick={() => { setEditando(null); setForm({ ...VACIA }); setBloques([{ titulo: "", texto: "" }]); setHtml(null); }} className="text-sm text-[var(--muted-foreground)]">
              Cancelar
            </button>
          )}
        </div>

        {html && (
          <div className="mt-4">
            <div className="mb-2 text-xs text-[var(--muted-foreground)]">Así se ve en el correo:</div>
            <iframe title="Vista previa de la carta" srcDoc={html} // Alto para ver la carta entera sin scrollear adentro del recuadro.
              className="h-[900px] w-full rounded-lg border border-[var(--border)] bg-white" />
          </div>
        )}
      </Panel>
      )}

      {aviso && <Note tone="ok">{aviso}</Note>}

      <Panel title="Cartas" subtitle="Una vez aprobada, el contenido no se toca: lo que sale es lo que se firmó.">
        {cartas.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">Todavía no hay ninguna carta.</p>
        ) : (
          <div className="space-y-2">
            {cartas.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{c.titulo}</span>
                    <Chip tone={TONO[c.estado]}>{c.estado.toLowerCase()}</Chip>
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {c.edicion} · programada {fecha(c.programadaPara)}
                    {c.estado === "ENVIADA" && ` · enviada ${fecha(c.enviadaEn)} a ${c.enviados} de ${c.alcanzados}`}
                    {c.errores > 0 && ` · ${c.errores} con error`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!soloLectura && c.estado === "BORRADOR" && (
                    <>
                      <button type="button" onClick={() => cargarEnForm(c)} className="btn btn-sm btn-quiet">Editar</button>
                      <button
                        type="button"
                        onClick={() => accion(c.id, `/api/cartas/${c.id}/aprobar`, `¿Aprobar «${c.titulo}»? Va a salir a ${padron.total} socios en la próxima pasada del cron.`)}
                        className="btn btn-sm"
                      >
                        <Check size={12} /> Aprobar
                      </button>
                    </>
                  )}
                  {!soloLectura && (c.estado === "BORRADOR" || c.estado === "APROBADA") && (
                    <button
                      type="button"
                      onClick={() => accion(c.id, `/api/cartas/${c.id}/probar`, "¿Mandar una prueba a la casilla del club?")}
                      className="btn btn-sm btn-quiet"
                    >
                      <Mail size={12} /> Prueba
                    </button>
                  )}
                  {!soloLectura && (c.estado === "APROBADA" || c.estado === "ENVIANDO") && (
                    <button
                      type="button"
                      onClick={() => accion(c.id, `/api/cartas/${c.id}/enviar`, `¿Enviar «${c.titulo}» ahora a los socios? Esto manda correos de verdad.`)}
                      className="btn btn-sm btn-quiet"
                    >
                      <Send size={12} /> Enviar ahora
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
