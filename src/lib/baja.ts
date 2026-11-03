/**
 * La baja de la carta del club, sin sesión: el link del correo tiene que funcionar años después.
 *
 * Va firmado con HMAC sobre el id del socio, así que no hace falta guardar tokens en la base ni
 * que el link caduque —una baja pedida desde un correo de hace dos años sigue valiendo— y nadie
 * puede darse de baja a otro cambiando un id a mano.
 *
 * No lleva vencimiento a propósito: un token de baja que expira es un socio que no se puede ir.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIJO = "v1";

/** El secreto es propio si existe; si no, cae en el de la app. Sin secreto no hay link válido. */
// `||` y no `??`: una variable definida pero vacía (lo que deja un `env` mal cargado) no puede
// anular la firma; si no, la baja queda desactivada en silencio.
const secreto = () => process.env.BAJA_SECRET?.trim() || process.env.AUTH_SECRET?.trim() || "";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const firma = (cuerpo: string, clave: string) => createHmac("sha256", clave).update(cuerpo).digest("base64url");

export function firmarBaja(memberId: string): string | null {
  const clave = secreto();
  if (!clave) return null;
  const cuerpo = `${PREFIJO}.${b64(memberId)}`;
  return `${cuerpo}.${firma(cuerpo, clave)}`;
}

export type BajaVerificada = { ok: true; memberId: string } | { ok: false; motivo: string };

export function verificarBaja(token: string | null | undefined): BajaVerificada {
  const clave = secreto();
  if (!clave) return { ok: false, motivo: "sin_secreto" };
  if (!token) return { ok: false, motivo: "sin_token" };
  const partes = token.split(".");
  if (partes.length !== 3 || partes[0] !== PREFIJO) return { ok: false, motivo: "formato" };
  const [, idB64, recibida] = partes;
  const cuerpo = `${PREFIJO}.${idB64}`;
  const esperada = firma(cuerpo, clave);
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, motivo: "firma" };
  const memberId = Buffer.from(idB64, "base64url").toString("utf8");
  if (!memberId) return { ok: false, motivo: "formato" };
  return { ok: true, memberId };
}

/**
 * La misma firma sirve para lo contrario: pedir la carta sin tener que entrar al portal.
 * Se llama distinto para que en el código se lea qué hace el link, no de qué archivo sale.
 */
export const firmarSocio = firmarBaja;
export const verificarSocio = verificarBaja;

/** Link de un click para sumarse a la carta (el club lo manda por WhatsApp o por correo). */
export function urlAltaCarta(memberId: string, base: string): string | null {
  const token = firmarBaja(memberId);
  if (!token) return null;
  return `${base.replace(/\/+$/, "")}/api/carta/alta?t=${encodeURIComponent(token)}`;
}

/** Link absoluto para el pie del correo. `base` es el origen del portal. */
export function urlBaja(memberId: string, base: string): string | null {
  const token = firmarBaja(memberId);
  if (!token) return null;
  return `${base.replace(/\/+$/, "")}/api/baja?t=${encodeURIComponent(token)}`;
}
