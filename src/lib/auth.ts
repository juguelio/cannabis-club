import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { forbidden, unauthorized, unprocessable } from "./errors";
import { tempPasswordExpired } from "./credentials";
import { assertNotLocked, recordFailure } from "./login-guard";

export const SESSION_COOKIE = "cc_session";
const SESSION_HOURS = 8;

export type Role = "ADMIN" | "OPERADOR" | "DISPENSADOR" | "SOCIO";
export type SessionUser = { id: string; email: string; name: string; role: Role; memberId?: string | null; mustChangePassword?: boolean; tokenVersion?: number };

const secretKey = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no está configurado");
  return new TextEncoder().encode(secret);
};

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export async function createSessionToken(user: SessionUser, tokenVersion = 0) {
  return new SignJWT({ email: user.email, name: user.name, role: user.role, tv: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<(SessionUser & { tokenVersion: number }) | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: String(payload.role ?? "SOCIO") as Role,
      tokenVersion: Number(payload.tv ?? 0),
    };
  } catch {
    return null;
  }
}

export async function startSession(user: SessionUser, tokenVersion = 0) {
  const token = await createSessionToken(user, tokenVersion);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * Cualquier usuario activo, incluido el socio (portal).
 * Una sola lectura por request: layout, página y componentes la piden por separado y antes eran
 * tres consultas iguales a la base (con la base lejos, cada una es un viaje de ida y vuelta).
 */
export const getAnySession = cache(readAnySession);

async function readAnySession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await readSessionToken(token);
  if (!claims) return null;
  const user = await prisma.user.findUnique({ where: { id: claims.id } });
  if (!user?.active) return null;
  // Restablecer la clave sube la versión: el token emitido antes deja de valer.
  if (user.tokenVersion !== claims.tokenVersion) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    memberId: user.memberId ?? null,
    mustChangePassword: user.mustChangePassword,
    tokenVersion: user.tokenVersion,
  };
}

/** Consola del club: ADMIN, OPERADOR y DISPENSADOR. Un socio no entra al backoffice. */
export async function getSession(): Promise<SessionUser | null> {
  const user = await getAnySession();
  if (!user || !["ADMIN", "OPERADOR", "DISPENSADOR"].includes(user.role)) return null;
  if (user.mustChangePassword) redirect("/cuenta/clave");
  return user;
}

/** Portal del socio: sesión con rol SOCIO ligada a una ficha del padrón. */
export async function getMemberSession(): Promise<(SessionUser & { memberId: string }) | null> {
  const user = await getAnySession();
  if (!user || user.role !== "SOCIO" || !user.memberId) return null;
  return { ...user, memberId: user.memberId };
}

export async function requireMember(): Promise<SessionUser & { memberId: string }> {
  const user = await getMemberSession();
  if (!user) throw unauthorized("Ingresá con tu cuenta de socio");
  assertPasswordChanged(user);
  return user;
}

/** Cualquier usuario con sesión válida (staff o socio): para cambiar la propia clave. */
export async function requireAnyUser(): Promise<SessionUser> {
  const user = await getAnySession();
  if (!user) throw unauthorized();
  return user;
}

function assertPasswordChanged(user: SessionUser) {
  if (user.mustChangePassword) throw unprocessable("PASSWORD_CHANGE_REQUIRED", "Cambiá tu clave temporal antes de continuar.");
}

export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getAnySession();
  if (!user || !["ADMIN", "OPERADOR", "DISPENSADOR"].includes(user.role)) throw unauthorized();
  assertPasswordChanged(user);
  if (roles && !roles.includes(user.role)) throw forbidden("Tu rol no permite esta acción");
  return user;
}

export async function authenticate(rawEmail: string, password: string, ip: string | null = null): Promise<SessionUser & { tokenVersion: number }> {
  const email = rawEmail.trim().toLowerCase();
  await assertNotLocked(email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    await recordFailure(email, ip);
    throw unauthorized("Email o contraseña incorrectos");
  }

  // Cuenta creada con Google: no hay clave que verificar y nunca va a haber una válida. Decirlo es la
  // diferencia entre «me sale denegado» y «tocá el botón de Google»: once cuentas quedaron trabadas sin
  // entender por qué fallaban (medido el 27/11 en producción).
  if (!user.passwordHash) {
    await recordFailure(email, ip);
    throw unauthorized(
      user.active
        ? "Esa cuenta se creó con Google y no tiene clave: entrá con «Continuar con Google»."
        : "Esa cuenta se creó con Google y tu alta quedó a mitad de camino. Entrá con «Continuar con Google» y completá tus datos.",
    );
  }

  // Acá ya hay clave: si no coincide, la respuesta no distingue nada (no se filtra si el email existe).
  if (!(await verifyPassword(password, user.passwordHash))) {
    await recordFailure(email, ip);
    throw unauthorized("Email o contraseña incorrectos");
  }

  // La clave era correcta: recién ahora se puede decir qué falta.
  if (!user.active) {
    await recordFailure(email, ip);
    throw unauthorized("Tu cuenta todavía no está habilitada. El club tiene que aprobarla.");
  }
  if (user.role === "SOCIO" && !user.memberId) {
    await recordFailure(email, ip);
    throw unauthorized("Tu cuenta no está vinculada a ningún legajo del padrón. Pedí el alta en la secretaría.");
  }
  // La clave dictada en el mostrador vence: no se puede seguir usando para siempre.
  if (user.mustChangePassword && tempPasswordExpired(user.passwordChangedAt)) {
    await recordFailure(email, ip);
    throw unprocessable("TEMP_PASSWORD_EXPIRED", "Esa clave temporal venció. Pedí una nueva en la secretaría del club.");
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    memberId: user.memberId ?? null,
    mustChangePassword: user.mustChangePassword,
    tokenVersion: user.tokenVersion,
  };
}
