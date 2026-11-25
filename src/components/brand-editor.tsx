"use client";

import { ValidatedForm, Input, Select, Textarea, type FormSubmission, type ReportFields } from "./validated-form";
/* eslint-disable @next/next/no-img-element -- vista previa de imágenes locales (data URL) */

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, ImagePlus, Plus, RotateCcw, Trash2, X } from "lucide-react";
import {
  brandSchema, contrastNotes, DEFAULT_COLORS, FUENTES_TEXTO, FUENTES_TITULO, IMAGE_KINDS, PALETAS, PASOS_DEFAULT, siglaOf, themeVars,
  type Brand, type ImageKind,
} from "@/lib/brand";
import { api, errMsg } from "@/lib/client";
import { BrandMark } from "./brand-mark";
import { useToast } from "./toast";

type ImageState = { error?: string; url: string | null; change?: string | null };

const COLOR_FIELDS: { key: keyof Brand["colores"]; label: string; hint: string }[] = [
  { key: "primario", label: "Primario", hint: "Botones, medidores y pestaña activa." },
  { key: "acento", label: "Acento", hint: "Selección, foco y lo que mide topes." },
  { key: "oscuro", label: "Oscuro", hint: "Barra lateral, balanza y portal." },
  { key: "claro", label: "Fondo", hint: "El fondo general de la app." },
  { key: "firma", label: "Firma", hint: "Monograma y detalles del sitio público." },
];

/** Achica la imagen en el navegador antes de subirla: el servidor solo valida. */
async function shrink(file: File, kind: ImageKind): Promise<string> {
  const spec = IMAGE_KINDS[kind];
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("No pudimos leer la imagen. Elegí un archivo PNG, JPG o WebP que puedas abrir en tu dispositivo.");
  });
  let side: number = spec.maxSide;
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("El navegador no pudo procesar la imagen");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let url: string;
    if (kind === "portada") url = canvas.toDataURL("image/jpeg", 0.82);
    else {
      url = canvas.toDataURL("image/webp", 0.92);
      if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/png");
    }
    const bytes = Math.ceil(((url.length - url.indexOf(",") - 1) * 3) / 4);
    if (bytes <= spec.maxBytes) return url;
    side = Math.round(side * 0.75);
  }
  throw new Error(`${spec.label}: no se pudo achicar por debajo de ${Math.round(spec.maxBytes / 1024)} KB`);
}

export function BrandEditor({
  initial,
  images: initialImages,
  nombre,
}: {
  initial: Brand;
  images: Record<ImageKind, string | null>;
  nombre: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [brand, setBrand] = useState<Brand>(initial);
  const [images, setImages] = useState<Record<ImageKind, ImageState>>({
    logo: { url: initialImages.logo },
    emblema: { url: initialImages.emblema },
    portada: { url: initialImages.portada },
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof Brand>(key: K, value: Brand[K]) => {
    setBrand((b) => ({ ...b, [key]: value }));
    setDirty(true);
  };
  const setColor = (key: keyof Brand["colores"], value: string) => set("colores", { ...brand.colores, [key]: value });
  const setContacto = (key: keyof Brand["contacto"], value: string) => set("contacto", { ...brand.contacto, [key]: value });
  const setSitio = <K extends keyof Brand["sitio"]>(key: K, value: Brand["sitio"][K]) => set("sitio", { ...brand.sitio, [key]: value });

  const validColors = useMemo(() => brandSchema.shape.colores.safeParse(brand.colores), [brand.colores]);
  const vars = useMemo(
    () => (validColors.success ? themeVars({ ...brand, colores: validColors.data }, { complete: true }) : {}),
    [validColors, brand],
  );
  const notes = validColors.success ? contrastNotes(validColors.data) : [];
  const mark = { logo: images.logo.url, sigla: siglaOf(brand, nombre), placa: brand.logoPlaca };

  async function pick(kind: ImageKind, file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const url = await shrink(file, kind);
      setImages((s) => ({ ...s, [kind]: { url, change: url } }));
      setDirty(true);
    } catch (err) {
      setImages(s => ({ ...s, [kind]: { ...s[kind], error: errMsg(err) } }));
    }
  }

  function drop(kind: ImageKind) {
    setImages((s) => ({ ...s, [kind]: { url: null, change: null } }));
    setDirty(true);
  }

  async function save(_: FormSubmission, reportFields: ReportFields) {
    const parsed = brandSchema.safeParse(brand);
    setError(null);
    if (!parsed.success) {
      reportFields(parsed.error.issues);
      return;
    }
    const body: Record<string, unknown> = { marca: parsed.data };
    for (const kind of Object.keys(IMAGE_KINDS) as ImageKind[]) {
      if (images[kind].change !== undefined) body[kind] = images[kind].change;
    }
    setBusy(true);
    try {
      const res = await api<{ version: number }>("/api/club/marca", { method: "PATCH", body });
      setImages((s) => {
        const next = { ...s };
        for (const kind of Object.keys(IMAGE_KINDS) as ImageKind[]) {
          next[kind] = { url: s[kind].url ? `/api/marca/${kind}?v=${res.version}` : null };
        }
        return next;
      });
      setBrand(parsed.data);
      setDirty(false);
      toast({ tone: "ok", title: "Marca guardada", text: "La app, el portal, el ingreso y el sitio ya la usan." });
      router.refresh();
    } catch (err) {
      if (!reportFields(err)) setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="brand-editor">
      <ValidatedForm className="stack" style={{ minWidth: 0 }} onSubmit={save}>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Imágenes</h2>
              <p className="panel-sub">PNG, JPG o WebP. Se achican solas antes de subir. El logo va en el menú, el ingreso y el portal; el emblema es el favicon y el sticker del sitio; la portada, la foto del sitio y del ingreso.</p>
            </div>
          </div>
          <div className="panel-body brand-images">
            {(Object.keys(IMAGE_KINDS) as ImageKind[]).map((kind) => (
              <ImageSlot key={kind} kind={kind} state={images[kind]} onPick={(f) => pick(kind, f)} onDrop={() => drop(kind)} />
            ))}
          </div>
          <div className="panel-body field-row" style={{ paddingTop: 0 }}>
            <label className="check">
              <Input type="checkbox" checked={brand.logoPlaca} onChange={(e) => set("logoPlaca", e.target.checked)} />
              <span>Logo sobre placa clara<span className="hint">Para logos con contorno oscuro que se pierden sobre la barra lateral.</span></span>
            </label>
            <div>
              <label className="label" htmlFor="b-sigla">Sigla (sin logo)</label>
              <Input className="input" id="b-sigla" name="sigla" value={brand.sigla} maxLength={3} placeholder={siglaOf({ ...brand, sigla: "" }, nombre)} onChange={(e) => set("sigla", e.target.value)} />
              <span className="hint">Hasta 3 letras para el monograma.</span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Colores</h2>
              <p className="panel-sub">Elegí libremente: la app ajusta cada tono para que el texto siga siendo legible.</p>
            </div>
            <button type="button" className="btn btn-sm btn-quiet" onClick={() => set("colores", DEFAULT_COLORS)}><RotateCcw aria-hidden />Original</button>
          </div>
          <div className="panel-body stack" style={{ gap: 14 }}>
            <div className="pal-list" role="group" aria-label="Paletas de partida">
              {PALETAS.map((p) => (
                <button key={p.key} type="button" className="pal-chip" onClick={() => set("colores", p.colores)} aria-label={`Usar paleta ${p.label}`}>
                  <span className="pal-dots" aria-hidden>
                    {(["oscuro", "primario", "acento", "claro", "firma"] as const).map((k) => <i key={k} style={{ background: p.colores[k] }} />)}
                  </span>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="field-row">
              {COLOR_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="label" htmlFor={`b-c-${f.key}`}>{f.label}</label>
                  <div className="color-field">
                    <Input
                      type="color"
                      aria-label={`${f.label}: selector`}
                      value={/^#[0-9a-f]{6}$/i.test(brand.colores[f.key]) ? brand.colores[f.key] : "#000000"}
                      onChange={(e) => setColor(f.key, e.target.value)}
                    />
                    <Input className="input tnum" id={`b-c-${f.key}`} name={`colores.${f.key}`} value={brand.colores[f.key]} maxLength={7} spellCheck={false} onChange={(e) => setColor(f.key, e.target.value)} />
                  </div>
                  <span className="hint">{f.hint}</span>
                </div>
              ))}
            </div>
            {!validColors.success ? <div className="note note-warn">Algún color no está en formato #rrggbb.</div> : null}
            {notes.length ? (
              <ul className="brand-notes">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><div><h2 className="panel-title">Tipografía y estilo</h2></div></div>
          <div className="panel-body field-row">
            <div>
              <label className="label" htmlFor="b-ft">Títulos</label>
              <Select className="select" id="b-ft" name="fuenteTitulos" value={brand.fuenteTitulos} onChange={(e) => set("fuenteTitulos", e.target.value as Brand["fuenteTitulos"])}>
                {Object.entries(FUENTES_TITULO).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
              </Select>
            </div>
            <div>
              <label className="label" htmlFor="b-fx">Texto</label>
              <Select className="select" id="b-fx" name="fuenteTexto" value={brand.fuenteTexto} onChange={(e) => set("fuenteTexto", e.target.value as Brand["fuenteTexto"])}>
                {Object.entries(FUENTES_TEXTO).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
              </Select>
            </div>
            <fieldset className="brand-radio" style={{ gridColumn: "1 / -1" }}>
              <legend className="label">Estilo</legend>
              <label className="check"><Input type="radio" name="estilo" checked={brand.estilo === "sobrio"} onChange={() => set("estilo", "sobrio")} /><span>Sobrio<span className="hint">La app tal cual: silenciosa, para el mostrador.</span></span></label>
              <label className="check"><Input type="radio" name="estilo" checked={brand.estilo === "afiche"} onChange={() => set("estilo", "afiche")} /><span>Afiche<span className="hint">Títulos en mayúscula y botones con trazo, como un cartel impreso.</span></span></label>
            </fieldset>
            <label className="check" style={{ gridColumn: "1 / -1" }}>
              <Input type="checkbox" checked={brand.nombreGotico} onChange={(e) => set("nombreGotico", e.target.checked)} />
              <span>Nombre del club en letra gótica<span className="hint">Solo el nombre y la sigla; el resto sigue en la letra elegida.</span></span>
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Sitio público</h2>
              <p className="panel-sub">Una página informativa para aspirantes y socios. No muestra productos ni precios: el club no vende ni publicita.</p>
            </div>
            <a className="btn btn-sm btn-quiet" href="/sitio" target="_blank" rel="noreferrer"><ExternalLink aria-hidden />Ver</a>
          </div>
          <div className="panel-body stack" style={{ gap: 14 }}>
            <label className="check">
              <Input type="checkbox" checked={brand.sitio.publico} onChange={(e) => setSitio("publico", e.target.checked)} />
              <span>Publicar el sitio<span className="hint">Apagado, la dirección del club lleva directo al ingreso.</span></span>
            </label>
            <div>
              <label className="label" htmlFor="b-lema">Lema</label>
              <Input className="input" id="b-lema" name="lema" value={brand.lema} maxLength={90} placeholder="Un club de la salud" onChange={(e) => set("lema", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="b-pres">Presentación</label>
              <Textarea className="textarea" id="b-pres" rows={4} maxLength={700} name="presentacion" value={brand.presentacion} placeholder="Quiénes somos, desde cuándo, qué nos mueve." onChange={(e) => set("presentacion", e.target.value)} />
              <span className="hint">{brand.presentacion.length}/700</span>
            </div>
            <div>
              <span className="label">Pasos para asociarse</span>
              <ol className="brand-steps">
                {brand.sitio.pasos.map((p, i) => (
                  <li key={i}>
                    <span className="tnum">{i + 1}</span>
                    <Input className="input" aria-label={`Paso ${i + 1}`} name={`sitio.pasos.${i}`} value={p} maxLength={200} onChange={(e) => setSitio("pasos", brand.sitio.pasos.map((x, j) => (j === i ? e.target.value : x)))} />
                    <button type="button" className="icon-btn" aria-label={`Quitar paso ${i + 1}`} onClick={() => setSitio("pasos", brand.sitio.pasos.filter((_, j) => j !== i))}><X /></button>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-2">
                {brand.sitio.pasos.length < 6 ? <button type="button" className="btn btn-sm btn-quiet" onClick={() => setSitio("pasos", [...brand.sitio.pasos, ""])}><Plus aria-hidden />Agregar paso</button> : null}
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSitio("pasos", PASOS_DEFAULT)}>Usar los pasos sugeridos</button>
              </div>
            </div>
            <label className="check">
              <Input type="checkbox" checked={brand.sitio.envios} onChange={(e) => setSitio("envios", e.target.checked)} />
              <span>Mostrar la sección de envíos<span className="hint">Para clubes que hacen traslados a socios con DDJJ.</span></span>
            </label>
            {brand.sitio.envios ? (
              <div>
                <label className="label" htmlFor="b-env">Cómo funcionan los envíos</label>
                <Textarea className="textarea" id="b-env" rows={3} maxLength={500} name="sitio.enviosTexto" value={brand.sitio.enviosTexto} placeholder="Zonas, días y requisitos." onChange={(e) => setSitio("enviosTexto", e.target.value)} />
              </div>
            ) : null}
            <div className="field-row">
              <div>
                <label className="label" htmlFor="b-wa">WhatsApp</label>
                <Input className="input tnum" id="b-wa" inputMode="numeric" name="contacto.whatsapp" value={brand.contacto.whatsapp} placeholder="5491100000000" onChange={(e) => setContacto("whatsapp", e.target.value.replace(/[^\d]/g, ""))} />
                <span className="hint">Con código de país, sin + ni espacios.</span>
              </div>
              <div>
                <label className="label" htmlFor="b-ig">Instagram</label>
                <Input className="input" id="b-ig" name="contacto.instagram" value={brand.contacto.instagram} placeholder="usuario" onChange={(e) => setContacto("instagram", e.target.value.replace(/^@/, ""))} />
              </div>
              <div>
                <label className="label" htmlFor="b-mail">Email</label>
                <Input className="input" id="b-mail" type="email" name="contacto.email" value={brand.contacto.email} onChange={(e) => setContacto("email", e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="b-zona">Zona</label>
                <Input className="input" id="b-zona" name="contacto.zona" value={brand.contacto.zona} placeholder="Barrio o localidad (sin dirección exacta)" onChange={(e) => setContacto("zona", e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="b-hor">Horario de atención</label>
                <Input className="input" id="b-hor" name="contacto.horario" value={brand.contacto.horario} placeholder="Lun a sáb, 10 a 19" onChange={(e) => setContacto("horario", e.target.value)} />
              </div>
            </div>
          </div>
        </section>

        {error ? <div className="note note-danger" role="alert">{error}</div> : null}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-lg" disabled={busy || !dirty}>{busy ? "Guardando…" : dirty ? "Guardar marca" : "Marca guardada"}</button>
          <span className="hint" style={{ margin: 0 }}>Queda registrado en la actividad del club.</span>
        </div>
      </ValidatedForm>

      <aside className="brand-preview-col" aria-label="Vista previa">
        <div className="bp" style={vars as React.CSSProperties} data-estilo={brand.estilo} data-gotico={brand.nombreGotico ? "" : undefined}>
          <div className="bp-label">Vista previa</div>
          <div className="bp-app">
            <div className="bp-rail">
              <div className="bp-brand">
                <BrandMark info={mark} />
                <span className="bp-club wordmark">{nombre}</span>
              </div>
              <span className="bp-link">Panel</span>
              <span className="bp-link" aria-current="page">Dispensario <b className="bp-count">2</b></span>
              <span className="bp-link">Socios</span>
              <span className="bp-link">Stock y lotes</span>
            </div>
            <div className="bp-main">
              <div className="bp-title">Dispensario</div>
              <div className="bp-panel">
                <div className="bp-row">
                  <span className="bp-avatar">MG</span>
                  <span style={{ flex: 1, minWidth: 0 }}><b>María Gómez</b><small>Legajo 12 · REPROCANN vigente</small></span>
                  <span className="bp-chip">Al día</span>
                </div>
                <div className="bp-input">Legajo, apellido o DNI</div>
                <div className="bp-meter"><i style={{ width: "62%" }} /></div>
                <div className="bp-actions"><span className="bp-btn">Nueva entrega</span><span className="bp-btn bp-btn--quiet">Ver ficha</span></div>
              </div>
              <div className="bp-scale">
                <div className="bp-readout">5<small> g</small></div>
                <div className="bp-gauge"><i className="u" style={{ width: "40%" }} /><i className="n" style={{ left: "40%", width: "10%" }} /></div>
                <span className="bp-btn bp-btn--accent">Registrar entrega</span>
              </div>
            </div>
          </div>
          <div className="bp-portal">
            <div className="bp-portal-top">
              <BrandMark info={mark} />
              <span style={{ minWidth: 0 }}><b className="wordmark">{nombre}</b><small>Portal del socio</small></span>
            </div>
            <div className="bp-allow"><small>Te quedan este mes</small><b>32<small> g</small></b></div>
          </div>
        </div>
        <p className="hint">Los cambios se ven acá al instante y en toda la app al guardar.</p>
      </aside>
    </div>
  );
}

function ImageSlot({ kind, state, onPick, onDrop }: { kind: ImageKind; state: ImageState; onPick: (f: File | undefined) => void; onDrop: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const spec = IMAGE_KINDS[kind];
  return (
    <div className={`img-slot img-slot--${kind}`}>
      <button type="button" className="img-slot-box" aria-describedby={state.error ? `imagen-error-${kind}` : undefined} onClick={() => input.current?.click()} aria-label={`${state.url ? "Cambiar" : "Cargar"} ${spec.label.toLowerCase()}`}>
        {state.url ? <img src={state.url} alt="" /> : <ImagePlus aria-hidden />}
      </button>
      <div className="img-slot-meta">
        <b>{spec.label}</b>
        {state.error && <small className="field-error" id={`imagen-error-${kind}`} role="alert">{state.error}</small>}
        <span className="hint" style={{ marginTop: 2 }}>{state.change ? "Sin guardar" : state.url ? "Cargada" : "Sin imagen"}</span>
        {state.url ? <button type="button" className="btn btn-sm btn-ghost" onClick={onDrop}><Trash2 aria-hidden />Quitar</button> : null}
      </div>
      <input ref={input} aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? `imagen-error-${kind}` : undefined} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
