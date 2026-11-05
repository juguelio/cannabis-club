import { z } from "zod";
import { contrast, ensureContrast, isHex, mix, normHex, readableInk } from "./color";

/**
 * Marca del club: lo que cambia de un club a otro sin tocar código.
 * Colores, tipografías, estilo, textos del sitio público y contacto. Las imágenes (logo, emblema,
 * portada) viven en columnas aparte y se sirven por /api/marca/<tipo>.
 *
 * Este módulo es puro (sin base ni Node): lo usan el servidor para inyectar el tema y el
 * editor de Configuración para la vista previa en vivo.
 */

const hex = z
  .string()
  .trim()
  .refine(isHex, "Usá un color en formato #rrggbb")
  .transform(normHex);

const optionalText = (max: number) => z.string().trim().max(max).default("");

const SISTEMA = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * Tipografías disponibles. La de sistema es la default: no descarga nada y hace que el template se
 * vea neutro; las demás son opt-in del club (se sirven desde `@fontsource` y las importa el layout).
 */
export const FUENTES_TITULO = {
  sistema: { label: "Sistema (sin descarga)", css: SISTEMA },
  bricolage: { label: "Bricolage Grotesque", css: '"Bricolage Grotesque Variable", "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif' },
  montserrat: { label: "Montserrat", css: '"Montserrat Variable", "Montserrat", ui-sans-serif, system-ui, sans-serif' },
} as const;

export const FUENTES_TEXTO = {
  sistema: { label: "Sistema (sin descarga)", css: SISTEMA },
  instrument: { label: "Instrument Sans", css: '"Instrument Sans Variable", "Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' },
  montserrat: { label: "Montserrat", css: '"Montserrat Variable", "Montserrat", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' },
} as const;

export const FUENTE_GOTICA = '"UnifrakturMaguntia", "Old English Text MT", serif';

export const PASOS_DEFAULT = [
  "Escribinos y coordinamos una entrevista con la comisión.",
  "Traé tu DNI y tu REPROCANN vigente (o te orientamos para tramitarlo).",
  "Firmás la solicitud de ingreso y el consentimiento informado.",
  "Con el alta aprobada, retirás en el dispensario dentro de tus topes.",
];

export const brandSchema = z.object({
  colores: z.object({
    /** Acción principal: botones, medidores, pestaña activa. */
    primario: hex,
    /** Selección, foco y lo que mide topes. */
    acento: hex,
    /** Superficies oscuras: barra lateral, balanza, encabezado del portal. */
    oscuro: hex,
    /** Fondo general de la app. */
    claro: hex,
    /** Color de firma del club: monograma, sitio público, detalles de identidad. */
    firma: hex,
  }),
  fuenteTitulos: z.enum(["sistema", "bricolage", "montserrat"]).default("sistema"),
  fuenteTexto: z.enum(["sistema", "instrument", "montserrat"]).default("sistema"),
  /** Nombre del club en letra gótica (como en un afiche o una remera). */
  nombreGotico: z.boolean().default(false),
  /** Sobrio: la app tal cual. Afiche: títulos en mayúscula, botones con trazo, más contraste. */
  estilo: z.enum(["sobrio", "afiche"]).default("sobrio"),
  /** El logo va sobre una placa clara (para logos con contorno oscuro). */
  logoPlaca: z.boolean().default(true),
  /** Hasta 3 letras para el monograma cuando no hay logo. */
  sigla: z.string().trim().max(3).default(""),
  lema: optionalText(90),
  // El club escribe acá su presentación institucional completa (varios párrafos separados por línea en blanco).
  presentacion: optionalText(2200),
  contacto: z
    .object({
      whatsapp: z.string().trim().regex(/^(\d{8,15})?$/, "WhatsApp: solo números, con código de país (ej. 5491100000000)").default(""),
      instagram: z.string().trim().regex(/^([A-Za-z0-9._]{1,30})?$/, "Instagram: el usuario sin @").default(""),
      email: z.union([z.literal(""), z.string().trim().email("Email inválido").max(120)]).default(""),
      zona: optionalText(120),
      horario: optionalText(120),
    })
    .default({ whatsapp: "", instagram: "", email: "", zona: "", horario: "" }),
  sitio: z
    .object({
      /** Si está apagado, la portada pública redirige al ingreso. */
      publico: z.boolean().default(false),
      pasos: z.array(z.string().trim().min(3).max(200)).max(6).default(PASOS_DEFAULT),
      envios: z.boolean().default(false),
      enviosTexto: optionalText(500),
    })
    .default({ publico: false, pasos: PASOS_DEFAULT, envios: false, enviosTexto: "" }),
});

export type Brand = z.infer<typeof brandSchema>;
export type BrandInput = z.input<typeof brandSchema>;

/** El aspecto base del template: un club sin marca configurada se ve exactamente así. */
export const DEFAULT_COLORS: Brand["colores"] = {
  primario: "#2f6f4f",
  acento: "#2b6cb0",
  oscuro: "#1f2933",
  claro: "#f4f5f7",
  firma: "#2f6f4f",
};

export const DEFAULT_BRAND: Brand = brandSchema.parse({ colores: DEFAULT_COLORS });

/** Paletas de partida para el editor; después cada color se ajusta a mano. */
export const PALETAS: { key: string; label: string; colores: Brand["colores"] }[] = [
  { key: "invernadero", label: "Neutra", colores: DEFAULT_COLORS },
  { key: "afiche", label: "Afiche", colores: { primario: "#111111", acento: "#f3c4d3", oscuro: "#111111", claro: "#f2ece2", firma: "#e8412a" } },
  { key: "rio", label: "Río", colores: { primario: "#1d4e89", acento: "#f59a1d", oscuro: "#0d1b2a", claro: "#eef2f6", firma: "#c9e3f1" } },
  { key: "terracota", label: "Terracota", colores: { primario: "#9a3b1f", acento: "#2f7d6d", oscuro: "#2a1712", claro: "#f4eee8", firma: "#e07a4f" } },
];

/** Lee lo guardado en la base sin romper nunca: lo inválido cae a los valores por defecto. */
export function parseStoredBrand(raw: unknown): Brand {
  if (!raw || typeof raw !== "object") return DEFAULT_BRAND;
  const obj = saneado(raw as Record<string, unknown>);
  const colores = { ...DEFAULT_COLORS, ...(typeof obj.colores === "object" && obj.colores ? obj.colores : {}) };
  const res = brandSchema.safeParse({ ...obj, colores });
  if (res.success) return res.data;
  // Rescate campo a campo: un dato viejo inválido no borra el resto de la marca.
  const out: Record<string, unknown> = { colores: DEFAULT_COLORS };
  for (const key of Object.keys(brandSchema.shape) as (keyof Brand)[]) {
    const field = brandSchema.shape[key].safeParse(key === "colores" ? colores : obj[key]);
    if (field.success) out[key] = field.data;
    else if (key === "sitio") out.sitio = rescatarSitio(obj.sitio);
  }
  return brandSchema.parse(out);
}

/**
 * Un paso de la portada con 250 caracteres tumbaba la marca entera y con ella la portada pública
 * (`sitio.publico` volvía al default apagado). Lo que se escribió de más se recorta; no se pierde
 * lo demás.
 */
function saneado(obj: Record<string, unknown>): Record<string, unknown> {
  const out = { ...obj };
  const recorta = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : v);
  out.lema = recorta(out.lema, 90);
  out.presentacion = recorta(out.presentacion, 2200);
  if (out.sitio && typeof out.sitio === "object") {
    const s = { ...(out.sitio as Record<string, unknown>) };
    s.enviosTexto = recorta(s.enviosTexto, 500);
    if (Array.isArray(s.pasos)) {
      s.pasos = s.pasos
        .filter((x): x is string => typeof x === "string" && x.trim().length >= 3)
        .slice(0, 6)
        .map((x) => x.trim().slice(0, 200));
    }
    out.sitio = s;
  }
  return out;
}

/** Rescate dentro de `sitio`: si un paso quedó mal, se conserva encendida la portada. */
function rescatarSitio(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  const sitio: Record<string, unknown> = { ...DEFAULT_BRAND.sitio };
  if (typeof s.publico === "boolean") sitio.publico = s.publico;
  if (typeof s.envios === "boolean") sitio.envios = s.envios;
  if (typeof s.enviosTexto === "string") sitio.enviosTexto = s.enviosTexto.slice(0, 500);
  if (Array.isArray(s.pasos)) {
    const pasos = s.pasos
      .filter((x): x is string => typeof x === "string" && x.trim().length >= 3)
      .slice(0, 6)
      .map((x) => x.trim().slice(0, 200));
    if (pasos.length) sitio.pasos = pasos;
  }
  return sitio;
}

const sameColors = (a: Brand["colores"], b: Brand["colores"]) =>
  (Object.keys(a) as (keyof Brand["colores"])[]).every((k) => a[k] === b[k]);

/**
 * Copia exacta de la paleta por defecto de globals.css (si cambia una, cambia la otra). Solo la usa la vista previa del editor
 * (`complete`), que tiene que poder mostrar "volver al original" aunque el club ya tenga otra marca.
 */
export const DEFAULT_THEME_VARS: Record<string, string> = {
  "--pine": "#1f2933", "--pine-2": "#27333f", "--pine-3": "#33404d",
  "--on-dark": "#eef1f5", "--on-dark-2": "#cbd3dc", "--on-dark-3": "#98a3b1",
  "--dark-line": "#313d4a", "--dark-line-2": "#44515f", "--dark-raised": "#28333f", "--dark-track": "#33404d", "--dark-used": "#6f7f8c",
  "--accent-on-dark": "#7fb0e0", "--accent-on-dark-2": "#a3c8ec", "--accent-on-dark-ink": "#1f2933",
  "--mist": "#f4f5f7", "--mist-2": "#e9ebef", "--paper-2": "#fafbfc",
  "--line": "#dfe3e8", "--line-soft": "#eceff2", "--line-strong": "#d2d7dd", "--line-hover": "#b8c0c9",
  "--ink": "#1a2027", "--ink-2": "#3d4652", "--muted": "#64707d", "--muted-2": "#97a1ad",
  "--leaf": "#2f6f4f", "--leaf-2": "#275c41", "--leaf-soft": "#e7efe9", "--leaf-ink": "#ffffff", "--leaf-text": "#2f6f4f",
  "--avatar": "#dfe7e2", "--bar": "#a9bfb2",
  "--violet": "#2b6cb0", "--violet-2": "#1f5490", "--violet-soft": "#e8f1fa", "--violet-faint": "#f7fafd", "--violet-ink": "#ffffff",
  "--firma": "#2f6f4f", "--firma-ink": "#ffffff",
};

/**
 * Variables CSS derivadas de la marca. Cada color se ajusta para mantener contraste legible
 * (WCAG AA en texto, 3:1 en bordes y foco), así un club puede elegir cualquier paleta.
 * Con los colores por defecto no se emite nada: rige la paleta afinada a mano de globals.css.
 */
export function themeVars(brand: Brand, opts: { complete?: boolean } = {}): Record<string, string> {
  const v: Record<string, string> = {};
  if (opts.complete || brand.fuenteTitulos !== "sistema") v["--font-display"] = FUENTES_TITULO[brand.fuenteTitulos].css;
  if (opts.complete || brand.fuenteTexto !== "sistema") v["--font-body"] = FUENTES_TEXTO[brand.fuenteTexto].css;
  v["--font-wordmark"] = brand.nombreGotico ? FUENTE_GOTICA : "var(--font-display)";
  if (sameColors(brand.colores, DEFAULT_COLORS)) return opts.complete ? { ...DEFAULT_THEME_VARS, ...v } : v;

  const { primario: P, acento: A, oscuro: D0, claro: L, firma: F } = brand.colores;
  const W = "#ffffff";
  // La superficie "oscura" tiene que ser oscura de verdad: el texto encima es claro.
  const D = ensureContrast(D0, W, 11);

  // Superficies oscuras (barra lateral, balanza, portal)
  v["--pine"] = D;
  v["--pine-2"] = mix(D, W, 0.07);
  v["--pine-3"] = mix(D, W, 0.14);
  v["--on-dark"] = mix(W, D, 0.04);
  v["--on-dark-2"] = mix(W, D, 0.17);
  v["--on-dark-3"] = ensureContrast(mix(W, D, 0.45), D, 4.6);
  v["--dark-line"] = mix(D, W, 0.11);
  v["--dark-line-2"] = mix(D, W, 0.22);
  v["--dark-raised"] = mix(D, W, 0.08);
  v["--dark-track"] = mix(D, W, 0.12);
  v["--dark-used"] = ensureContrast(mix(P, W, 0.35), D, 3);
  const accentOnDark = ensureContrast(A, D, 5.5);
  v["--accent-on-dark"] = accentOnDark;
  v["--accent-on-dark-2"] = mix(accentOnDark, W, 0.25);
  v["--accent-on-dark-ink"] = readableInk(accentOnDark, W, D);

  // Fondo y tinta
  v["--mist"] = L;
  v["--mist-2"] = mix(L, D, 0.05);
  v["--paper-2"] = mix(W, L, 0.5);
  v["--line"] = mix(L, D, 0.1);
  v["--line-soft"] = mix(L, D, 0.045);
  v["--line-strong"] = mix(L, D, 0.2);
  v["--line-hover"] = mix(L, D, 0.3);
  const ink = ensureContrast(mix(D, "#000000", 0.15), W, 13);
  v["--ink"] = ink;
  v["--ink-2"] = ensureContrast(mix(ink, W, 0.25), W, 8);
  v["--muted"] = ensureContrast(mix(ink, L, 0.5), L, 4.6);
  v["--muted-2"] = mix(ink, L, 0.6);

  // Acción principal
  const leaf = ensureContrast(P, W, 3);
  v["--leaf"] = leaf;
  v["--leaf-2"] = mix(leaf, contrast(leaf, "#000") > contrast(leaf, W) ? W : "#000000", 0.14);
  v["--leaf-soft"] = mix(leaf, W, 0.87);
  v["--leaf-ink"] = readableInk(leaf);
  v["--leaf-text"] = ensureContrast(leaf, W, 4.6);
  v["--avatar"] = mix(leaf, W, 0.82);
  v["--bar"] = mix(leaf, W, 0.68);

  // Acento: selección, foco, topes
  const violet = ensureContrast(A, W, 3);
  v["--violet"] = violet;
  v["--violet-2"] = ensureContrast(A, W, 5.5);
  v["--violet-soft"] = mix(A, W, 0.86);
  v["--violet-faint"] = mix(A, W, 0.95);
  v["--violet-ink"] = readableInk(violet);

  // Firma
  v["--firma"] = F;
  v["--firma-ink"] = readableInk(F);
  return v;
}

export function themeCss(brand: Brand): string {
  const vars = themeVars(brand);
  const body = Object.entries(vars).map(([k, val]) => `${k}:${val}`).join(";");
  return `:root{${body}}`;
}

/** Sigla para el monograma: la configurada o las iniciales del nombre. */
export function siglaOf(brand: Brand, nombre: string): string {
  if (brand.sigla) return brand.sigla.toUpperCase();
  const skip = new Set(["de", "del", "la", "el", "los", "las", "y", "asociación", "asociacion", "civil", "ong", "club"]);
  const words = nombre.split(/\s+/).filter((w) => w && !skip.has(w.toLowerCase()));
  return (words.slice(0, 2).map((w) => w[0]).join("") || nombre.slice(0, 2)).toUpperCase();
}

export function whatsappHref(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/** Avisos de contraste para el editor: qué combinación quedó corregida automáticamente. */
export function contrastNotes(colores: Brand["colores"]): string[] {
  const notes: string[] = [];
  const W = "#ffffff";
  if (contrast(colores.oscuro, W) < 11) notes.push("El color oscuro es claro para llevar texto blanco encima: se oscurece automáticamente.");
  if (contrast(colores.primario, W) < 3) notes.push("El primario es muy claro sobre blanco: los botones usan una versión más intensa.");
  if (contrast(colores.acento, W) < 3) notes.push("El acento es muy claro para marcar foco sobre blanco: se usa más intenso en la parte clara y tal cual sobre lo oscuro.");
  if (contrast(colores.claro, W) > 1.35) notes.push("El fondo claro está bastante oscuro: puede restar contraste a los textos secundarios.");
  return notes;
}

export const IMAGE_KINDS = {
  logo: { label: "Logo", maxBytes: 400_000, maxSide: 640 },
  emblema: { label: "Emblema o sticker", maxBytes: 400_000, maxSide: 640 },
  portada: { label: "Foto de portada", maxBytes: 1_200_000, maxSide: 1800 },
} as const;
export type ImageKind = keyof typeof IMAGE_KINDS;
export const IMAGE_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
