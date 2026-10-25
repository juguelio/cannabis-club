/**
 * Utilidades de color para la marca del club. Sin dependencias: hex ⇄ RGB, mezcla en sRGB,
 * luminancia y contraste WCAG 2.x, y ajuste de un color hasta alcanzar un contraste mínimo.
 */

export type Rgb = [number, number, number];

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(value: string): boolean {
  return HEX.test(value.trim());
}

export function parseHex(value: string): Rgb {
  const m = HEX.exec(value.trim());
  if (!m) throw new Error(`Color inválido: ${value}`);
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

export function toHex([r, g, b]: Rgb): string {
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Normaliza a `#rrggbb` en minúsculas. */
export function normHex(value: string): string {
  return toHex(parseHex(value));
}

/** Mezcla `a` con `b`: t=0 devuelve `a`, t=1 devuelve `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as Rgb);
}

export function luminance(hex: string): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = parseHex(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.18;
}

/** Tinta legible sobre `bg`: la que más contraste da entre casi-blanco y casi-negro. */
export function readableInk(bg: string, light = "#ffffff", dark = "#111111"): string {
  return contrast(light, bg) >= contrast(dark, bg) ? light : dark;
}

/**
 * Acerca `fg` a negro o a blanco (lo que se aleje de `bg`) hasta llegar a `min` de contraste.
 * Conserva el tono todo lo posible: avanza de a 4 %.
 */
export function ensureContrast(fg: string, bg: string, min: number): string {
  if (contrast(fg, bg) >= min) return normHex(fg);
  const toward = isDark(bg) ? "#ffffff" : "#000000";
  for (let t = 0.04; t <= 1; t += 0.04) {
    const c = mix(fg, toward, t);
    if (contrast(c, bg) >= min) return c;
  }
  return toward;
}
