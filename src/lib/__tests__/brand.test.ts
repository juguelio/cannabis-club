import { describe, expect, it } from "vitest";
import { contrast, ensureContrast, mix, normHex, parseHex, readableInk } from "../color";
import { brandSchema, contrastNotes, DEFAULT_BRAND, DEFAULT_COLORS, DEFAULT_THEME_VARS, PALETAS, parseStoredBrand, siglaOf, themeCss, themeVars, whatsappHref } from "../brand";
import { decodeDataUrl, validateBrandImage } from "../brand-image";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("color", () => {
  it("lee y normaliza hex", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(normHex("1F5A3F")).toBe("#1f5a3f");
    expect(() => parseHex("verde")).toThrow();
  });

  it("mezcla y mide contraste WCAG", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("elige la tinta legible", () => {
    expect(readableInk("#111111")).toBe("#ffffff");
    expect(readableInk("#f3c4d3")).toBe("#111111");
  });

  it("ajusta un color hasta el contraste pedido sin cambiar los que ya cumplen", () => {
    expect(ensureContrast("#1f5a3f", "#ffffff", 4.5)).toBe("#1f5a3f");
    const fixed = ensureContrast("#f3c4d3", "#ffffff", 4.5);
    expect(contrast(fixed, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    const onDark = ensureContrast("#6f42c1", "#10231b", 5.5);
    expect(contrast(onDark, "#10231b")).toBeGreaterThanOrEqual(5.5);
  });
});

describe("marca guardada: nada de esto puede apagar la portada", () => {
  const base = { lema: "Cultivo solidario", sitio: { publico: true, envios: true, pasos: ["Uno", "Dos", "Tres"] } };

  it("un paso demasiado largo se recorta y la portada sigue encendida", () => {
    const largo = "a".repeat(260);
    const b = parseStoredBrand({ ...base, sitio: { ...base.sitio, pasos: ["Uno", largo] } });
    expect(b.sitio.publico).toBe(true);
    expect(b.sitio.pasos[1].length).toBe(200);
  });

  it("una presentación eterna no se lleva puesto el resto", () => {
    const b = parseStoredBrand({ ...base, presentacion: "p".repeat(3000) });
    expect(b.sitio.publico).toBe(true);
    expect(b.presentacion.length).toBe(2200);
    expect(b.lema).toBe("Cultivo solidario");
  });

  it("un email inválido en contacto no apaga el sitio", () => {
    const b = parseStoredBrand({ ...base, contacto: { email: "no-es-un-email" } });
    expect(b.sitio.publico).toBe(true);
    expect(b.contacto.email).toBe("");
  });

  it("si `sitio` entero está roto, se rescata el encendido", () => {
    const b = parseStoredBrand({ ...base, sitio: { publico: true, pasos: ["", ""] } });
    expect(b.sitio.publico).toBe(true);
  });
});

describe("marca", () => {
  it("sin colores propios no emite paleta: rige la de globals.css", () => {
    const vars = themeVars(DEFAULT_BRAND);
    expect(vars["--pine"]).toBeUndefined();
    expect(vars["--font-wordmark"]).toBe("var(--font-display)");
    expect(themeCss(DEFAULT_BRAND)).toBe(":root{--font-wordmark:var(--font-display)}");
  });

  it("la vista previa completa devuelve la paleta original exacta", () => {
    const vars = themeVars(DEFAULT_BRAND, { complete: true });
    for (const [k, v] of Object.entries(DEFAULT_THEME_VARS)) expect(vars[k]).toBe(v);
  });

  it.each(PALETAS.filter((p) => p.key !== "invernadero"))("la paleta $label mantiene texto legible", ({ colores }) => {
    const v = themeVars(brandSchema.parse({ colores }));
    expect(contrast(v["--on-dark"], v["--pine"])).toBeGreaterThanOrEqual(7);
    expect(contrast(v["--on-dark-3"], v["--pine"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v["--leaf-ink"], v["--leaf"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v["--violet-ink"], v["--violet"])).toBeGreaterThanOrEqual(3);
    expect(contrast(v["--accent-on-dark-ink"], v["--accent-on-dark"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v["--ink"], "#ffffff")).toBeGreaterThanOrEqual(13);
    expect(contrast(v["--muted"], v["--mist"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v["--leaf-text"], "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("un oscuro demasiado claro se oscurece para que el texto blanco se lea", () => {
    const v = themeVars(brandSchema.parse({ colores: { ...DEFAULT_COLORS, oscuro: "#f3c4d3" } }));
    expect(contrast("#ffffff", v["--pine"])).toBeGreaterThanOrEqual(11);
    expect(contrastNotes({ ...DEFAULT_COLORS, oscuro: "#f3c4d3" }).length).toBeGreaterThan(0);
  });

  it("República: fuente, gótica y afiche", () => {
    const b = brandSchema.parse({
      colores: PALETAS.find((p) => p.key === "afiche")!.colores,
      fuenteTitulos: "montserrat",
      fuenteTexto: "montserrat",
      nombreGotico: true,
      estilo: "afiche",
    });
    const v = themeVars(b);
    expect(v["--font-display"]).toContain("Montserrat");
    expect(v["--font-wordmark"]).toContain("UnifrakturMaguntia");
  });

  it("valida contacto", () => {
    const ok = brandSchema.safeParse({ colores: DEFAULT_COLORS, contacto: { whatsapp: "5491156160623", instagram: "republica.ong" } });
    expect(ok.success).toBe(true);
    expect(brandSchema.safeParse({ colores: DEFAULT_COLORS, contacto: { whatsapp: "+54 11" } }).success).toBe(false);
    expect(brandSchema.safeParse({ colores: DEFAULT_COLORS, contacto: { instagram: "@x y" } }).success).toBe(false);
    expect(brandSchema.safeParse({ colores: { ...DEFAULT_COLORS, primario: "rojo" } }).success).toBe(false);
  });

  it("lo guardado inválido no rompe: rescata campo por campo", () => {
    expect(parseStoredBrand(null)).toEqual(DEFAULT_BRAND);
    const b = parseStoredBrand({ colores: { primario: "nope", acento: "#ff0000" }, lema: "Un club de la salud", estilo: "otro" });
    expect(b.lema).toBe("Un club de la salud");
    expect(b.estilo).toBe("sobrio");
    expect(b.colores).toEqual(DEFAULT_COLORS);
    const partial = parseStoredBrand({ colores: { acento: "#FF0000" } });
    expect(partial.colores.acento).toBe("#ff0000");
    expect(partial.colores.primario).toBe(DEFAULT_COLORS.primario);
  });

  it("sigla y WhatsApp", () => {
    expect(siglaOf(DEFAULT_BRAND, "Asociación Civil República ONG")).toBe("R");
    expect(siglaOf({ ...DEFAULT_BRAND, sigla: "rc" }, "x")).toBe("RC");
    expect(siglaOf(DEFAULT_BRAND, "Cultivo del Sur")).toBe("CS");
    expect(whatsappHref("5491100000000", "Hola, quiero info")).toBe("https://wa.me/5491100000000?text=Hola%2C%20quiero%20info");
  });
});

describe("imágenes de marca", () => {
  it("acepta PNG real", () => {
    expect(decodeDataUrl(PNG_1PX)?.mime).toBe("image/png");
    expect(validateBrandImage("logo", PNG_1PX)).toBe(PNG_1PX);
  });

  it("rechaza SVG, tipos mentidos y basura", () => {
    expect(decodeDataUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBeNull();
    expect(decodeDataUrl(PNG_1PX.replace("image/png", "image/jpeg"))).toBeNull();
    expect(decodeDataUrl("data:image/png;base64,aG9sYQ==")).toBeNull();
    expect(() => validateBrandImage("logo", "https://example.com/logo.png")).toThrow(/PNG, JPG o WebP/);
  });

  it("rechaza lo que supera el tamaño", () => {
    const big = Buffer.alloc(450_000);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(big);
    expect(() => validateBrandImage("logo", `data:image/png;base64,${big.toString("base64")}`)).toThrow(/máximo/);
  });
});
