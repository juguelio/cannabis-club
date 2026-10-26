import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/http";
import { startSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, exchangeAndVerify, googleConfig, openState } from "@/lib/google";
import { crearSesionSolicitud } from "@/lib/onboarding";
import { MAX_ALTAS_POR_IP_24H, decideGoogleLogin, pendingDefaults } from "@/lib/google-rules";

const destino = (role: string) => (role === "SOCIO" ? "/portal" : "/");

/**
 * Vuelta de Google. Google prueba quién sos; el acceso lo sigue decidiendo el club:
 * nadie entra con una cuenta que no esté activa y, si es socio, atada a un legajo.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  // El origen sale de APP_BASE_URL: en local Next arma `req.url` con `localhost`
  // y la cookie termina en otro origen que el que sigue el navegador.
  const base = process.env.APP_BASE_URL || url.origin;
  const origin = base.endsWith("/") ? base.slice(0, -1) : base;
  const volver = (qs: string) => NextResponse.redirect(`${origin}/login?${qs}`, 302);

  const cfg = googleConfig();
  if (!cfg) return volver("error=google_no_configurado");

  const jar = await cookies();
  const sealed = jar.get(OAUTH_COOKIE)?.value;
  jar.delete({ name: OAUTH_COOKIE, path: OAUTH_COOKIE_PATH });
  if (!sealed) return volver("error=google_estado");
  const state = await openState(sealed);
  if (!state) return volver("error=google_estado");
  if (url.searchParams.get("state") !== state.nonce) return volver("error=google_estado");
  if (url.searchParams.get("error")) return volver("error=google_cancelado");

  const code = url.searchParams.get("code");
  if (!code) return volver("error=google_codigo");

  let profile;
  try {
    profile = await exchangeAndVerify(cfg, code, state.verifier);
  } catch (error) {
    console.error("[google] no se pudo validar la identidad", error);
    return volver("error=google_validacion");
  }

  const ip = clientIp(req);
  const user = await prisma.user.findFirst({
    where: { OR: [{ googleSub: profile.sub }, { email: profile.email }] },
    select: { id: true, email: true, name: true, role: true, active: true, memberId: true, googleSub: true, tokenVersion: true, mustChangePassword: true },
  });

  const decision = decideGoogleLogin(user, profile);

  // Si la cuenta existe pero no está habilitada y no tiene legajo, está a mitad del onboarding:
  // se la manda a completar la solicitud en vez de rechazarla (puede volver cuantas veces quiera).
  const aMitad = (u: typeof user) => !!u && !u.active && !u.memberId;

  if (decision.kind === "pendiente") {
    if (aMitad(user)) {
      await crearSesionSolicitud(user!.id);
      return NextResponse.redirect(`${origin}/solicitud`, 302);
    }
    return volver(`error=${decision.motivo.toLowerCase()}`);
  }

  if (decision.kind === "alta_inactiva") {
    // Freno anti-abuso: un bot no puede llenar el padrón de cuentas pendientes.
    const desde = new Date(Date.now() - 24 * 3600 * 1000);
    const altas = await prisma.auditLog.count({ where: { action: "USER_PENDING", ip, createdAt: { gte: desde } } });
    if (altas >= MAX_ALTAS_POR_IP_24H) return volver("error=google_limite");

    const creada = await prisma.user.create({
      data: { ...pendingDefaults(profile), passwordHash: null },
      select: { id: true, email: true, role: true },
    });
    await audit({
      actorId: null,
      action: "USER_PENDING",
      entity: "User",
      entityId: creada.id,
      ip,
      payload: { email: creada.email, via: "google", googleSub: profile.sub },
    });
    // Se abre la sesión de onboarding: con esa cookie sólo se llega a /solicitud.
    await crearSesionSolicitud(creada.id);
    return NextResponse.redirect(`${origin}/solicitud`, 302);
  }

  // Sesión: si es la primera vez con Google, se ata el `sub` a esta cuenta.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user!.id },
      data: { lastLoginAt: new Date(), ...(decision.bind ? { googleSub: profile.sub } : {}) },
    });
    await tx.auditLog.create({
      data: {
        actorId: user!.id,
        action: "LOGIN_GOOGLE",
        entity: "User",
        entityId: user!.id,
        ip,
        payload: { email: user!.email, bind: decision.bind },
      },
    });
  });

  await startSession(
    { id: user!.id, email: user!.email, name: user!.name, role: user!.role as "ADMIN" | "OPERADOR" | "SOCIO", memberId: user!.memberId, mustChangePassword: user!.mustChangePassword },
    user!.tokenVersion,
  );
  return NextResponse.redirect(`${origin}${destino(user!.role)}`, 302);
}
