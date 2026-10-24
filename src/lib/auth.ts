import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { forbidden, unauthorized } from "./errors";

export const SESSION_COOKIE = "cc_session";
const SESSION_HOURS = 8;

export type Role = "ADMIN" | "OPERADOR" | "SOCIO";
export type SessionUser = { id: string; email: string; name: string; role: Role };

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

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw unauthorized();
  if (roles && !roles.includes(user.role)) throw forbidden("Tu rol no permite esta acción");
  return user;
}

export async function authenticate(email: string, password: string): Promise<SessionUser> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.active) throw unauthorized("Credenciales inválidas");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw unauthorized("Credenciales inválidas");
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { id: user.id, email: user.email, name: user.name, role: user.role as Role };
}
