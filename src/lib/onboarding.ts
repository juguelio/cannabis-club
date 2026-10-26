import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Sesión de onboarding: la persona ya pasó por Google pero todavía no es socia.
 * No es la sesión normal (`cc_session`) a propósito: con esta cookie sólo se puede
 * llegar a `/solicitud` y a sus endpoints, nunca a la consola ni al portal.
 */
export const SOLICITUD_COOKIE = "cc_solicitud";
export const SOLICITUD_PATH = "/solicitud";
const SOLICITUD_HOURS = 4;

const secretKey = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no está configurado");
  return new TextEncoder().encode(secret);
};

export async function crearSesionSolicitud(userId: string) {
  const token = await new SignJWT({ scope: "solicitud" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SOLICITUD_HOURS}h`)
    .sign(secretKey());

  const jar = await cookies();
  jar.set(SOLICITUD_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SOLICITUD_HOURS * 3600,
  });
}

export async function leerSesionSolicitud(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SOLICITUD_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.scope !== "solicitud" || !payload.sub) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export async function borrarSesionSolicitud() {
  const jar = await cookies();
  jar.delete({ name: SOLICITUD_COOKIE, path: "/" });
}
