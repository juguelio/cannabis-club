import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { forbidden, unauthorized } from "./errors";
import { assertNotLocked, recordFailure } from "./login-guard";

export const SESSION_COOKIE = "cc_session";
const SESSION_HOURS = 8;

export type Role = "ADMIN" | "OPERADOR" | "SOCIO";
export type SessionUser = { id: string; email: string; name: string; role: Role; memberId?: string | null };

const secretKey = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no está configurado");
  return new TextEncoder().encode(secret);
};

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: String(payload.role ?? "SOCIO") as Role,
    };
  } catch {
    return null;
  }
}

export async function startSession(user: SessionUser) {
  const token = await createSessionToken(user);
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

/** Cualquier usuario activo, incluido el socio (portal). */
export async function getAnySession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await readSessionToken(token);
  if (!claims) return null;
  const user = await prisma.user.findUnique({ where: { id: claims.id } });
  if (!user?.active) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    memberId: user.memberId ?? null,
  };
}

/** Consola del club: sólo ADMIN y OPERADOR. Un socio no entra al backoffice. */
export async function getSession(): Promise<SessionUser | null> {
  const user = await getAnySession();
  if (!user || !["ADMIN", "OPERADOR"].includes(user.role)) return null;
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
  return user;
}

export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw unauthorized();
  if (roles && !roles.includes(user.role)) throw forbidden("Tu rol no permite esta acción");
  return user;
}

export async function authenticate(rawEmail: string, password: string, ip: string | null = null): Promise<SessionUser> {
  const email = rawEmail.trim().toLowerCase();
  await assertNotLocked(email);
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = Boolean(user?.active) && !(user!.role === "SOCIO" && !user!.memberId) && (await verifyPassword(password, user!.passwordHash));
  if (!user || !ok) {
    await recordFailure(email, ip);
    throw unauthorized("Email o contraseña incorrectos");
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { id: user.id, email: user.email, name: user.name, role: user.role as Role, memberId: user.memberId ?? null };
}
