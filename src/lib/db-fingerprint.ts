import { createHash } from "node:crypto";

/**
 * Huella de la base: identifica el servidor y la base sin exponer la cadena de
 * conexión. Sirve para dos cosas: comparar entornos y evitar que un preview escriba
 * sobre la base real.
 */
export function huellaBase(url = process.env.DATABASE_URL ?? "") {
  const host = url.match(/@([^/:]+)/)?.[1] ?? "";
  const base = url.split("?")[0].split("/").pop() ?? "";
  if (!host) return null;
  return createHash("sha256").update(`${host}/${base}`).digest("hex").slice(0, 12);
}

/** true si esta instancia está apuntando a la misma base que producción. */
export function apuntaAProduccion(url = process.env.DATABASE_URL ?? "") {
  const prod = process.env.PROD_DB_FINGERPRINT;
  if (!prod) return false;
  if (huellaBase(url) === prod) return true;
  // Neon ofrece dos hosts para la misma base: directo y pooler. Conservamos las
  // huellas ya configuradas, comparando también el alias del mismo endpoint.
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(".neon.tech")) return false;
    const [endpoint, ...domain] = parsed.hostname.split(".");
    parsed.hostname = `${endpoint.endsWith("-pooler") ? endpoint.slice(0, -7) : `${endpoint}-pooler`}.${domain.join(".")}`;
    return huellaBase(parsed.toString()) === prod;
  } catch {
    return false;
  }
}
