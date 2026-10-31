import { timingSafeEqual } from "node:crypto";

/**
 * Los crons de Vercel llegan sin sesión: se autentican con `Authorization: Bearer $CRON_SECRET`.
 * Si la variable no está configurada, **todo se rechaza** — un cron sin secreto sería un endpoint
 * público que purga datos o mueve precios.
 */
export function esCron(req: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || secreto.length < 16) return false;
  const recibido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${secreto}`);
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}

/** Respuesta única para no distinguir «sin secreto» de «secreto incorrecto». */
export const NO_AUTORIZADO = { error: "UNAUTHORIZED", message: "Sólo el cron del club." } as const;
