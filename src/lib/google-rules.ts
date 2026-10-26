/**
 * Reglas del ingreso con Google, sin Prisma ni `server-only`: así se pueden probar.
 *
 * Decisión de producto: Google prueba la identidad, pero **no** otorga acceso.
 * Un email desconocido crea una cuenta **inactiva** que el club aprueba desde
 * Configuración; sin aprobación no hay sesión.
 */

export type GoogleProfileLike = { sub: string; email: string; emailVerified: boolean; name: string };

export type UserLike = {
  id: string;
  email: string;
  role: string;
  active: boolean;
  memberId: string | null;
  googleSub: string | null;
};

export type Motivo = "EMAIL_NO_VERIFICADO" | "CUENTA_INACTIVA" | "SOCIO_SIN_LEGAJO" | "OTRA_CUENTA_GOOGLE";

export type Decision =
  | { kind: "sesion"; bind: boolean }
  | { kind: "pendiente"; motivo: Motivo }
  | { kind: "alta_inactiva" };

export const MOTIVO_TEXTO: Record<Motivo, string> = {
  EMAIL_NO_VERIFICADO: "Ese email de Google no está verificado. Usá una cuenta con el email confirmado.",
  CUENTA_INACTIVA: "Tu cuenta todavía no está habilitada. El club tiene que aprobarla.",
  SOCIO_SIN_LEGAJO: "Tu cuenta no está vinculada a ningún legajo del padrón. Pedí el alta en la secretaría.",
  OTRA_CUENTA_GOOGLE: "Ese email ya está vinculado a otra cuenta de Google. Hablá con la secretaría del club.",
};

export function decideGoogleLogin(user: UserLike | null, profile: GoogleProfileLike): Decision {
  if (!profile.emailVerified) return { kind: "pendiente", motivo: "EMAIL_NO_VERIFICADO" };
  if (!user) return { kind: "alta_inactiva" };
  if (!user.active) return { kind: "pendiente", motivo: "CUENTA_INACTIVA" };
  if (user.role === "SOCIO" && !user.memberId) return { kind: "pendiente", motivo: "SOCIO_SIN_LEGAJO" };
  // Si el email ya estaba atado a otra identidad de Google, no se pisa: es un choque de identidad.
  if (user.googleSub && user.googleSub !== profile.sub) return { kind: "pendiente", motivo: "OTRA_CUENTA_GOOGLE" };
  return { kind: "sesion", bind: !user.googleSub };
}

/** El alta automática nunca crea equipo: entra como SOCIO inactivo y sin legajo. */
export const pendingDefaults = (profile: GoogleProfileLike) => ({
  email: profile.email,
  name: profile.name.slice(0, 80),
  role: "SOCIO" as const,
  active: false,
  googleSub: profile.sub,
});

/** Techo de altas automáticas por IP en 24 h: un bot no puede llenar el padrón de cuentas. */
export const MAX_ALTAS_POR_IP_24H = 8;
