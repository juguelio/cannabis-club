import { describe, expect, it } from "vitest";
import { MAX_ALTAS_POR_IP_24H, decideGoogleLogin, pendingDefaults } from "../google-rules";

const perfil = { sub: "google-123", email: "maria@club.test", emailVerified: true, name: "María Gómez" };
const usuario = {
  id: "u1",
  email: "maria@club.test",
  role: "SOCIO",
  active: true,
  memberId: "m1",
  googleSub: null as string | null,
};

describe("ingreso con Google", () => {
  it("un email desconocido no entra: crea una cuenta inactiva", () => {
    expect(decideGoogleLogin(null, perfil)).toEqual({ kind: "alta_inactiva" });
  });

  it("el alta automática es SOCIO, inactiva y sin clave", () => {
    const alta = pendingDefaults(perfil);
    expect(alta).toMatchObject({ role: "SOCIO", active: false, email: "maria@club.test", googleSub: "google-123" });
    expect("passwordHash" in alta).toBe(false);
  });

  it("un email de Google sin verificar no crea nada", () => {
    expect(decideGoogleLogin(null, { ...perfil, emailVerified: false })).toEqual({
      kind: "pendiente",
      motivo: "EMAIL_NO_VERIFICADO",
    });
  });

  it("una cuenta desactivada no entra", () => {
    expect(decideGoogleLogin({ ...usuario, active: false }, perfil)).toEqual({ kind: "pendiente", motivo: "CUENTA_INACTIVA" });
  });

  it("un socio sin legajo no entra, aunque el email exista", () => {
    expect(decideGoogleLogin({ ...usuario, memberId: null }, perfil)).toEqual({
      kind: "pendiente",
      motivo: "SOCIO_SIN_LEGAJO",
    });
  });

  it("la primera vez ata el sub de Google a la cuenta", () => {
    expect(decideGoogleLogin(usuario, perfil)).toEqual({ kind: "sesion", bind: true });
  });

  it("si vuelve con el mismo sub, no vuelve a atar", () => {
    expect(decideGoogleLogin({ ...usuario, googleSub: "google-123" }, perfil)).toEqual({ kind: "sesion", bind: false });
  });

  it("un email ya atado a otro sub no se pisa", () => {
    expect(decideGoogleLogin({ ...usuario, googleSub: "google-OTRO" }, perfil)).toEqual({
      kind: "pendiente",
      motivo: "OTRA_CUENTA_GOOGLE",
    });
  });

  it("el techo de altas por IP es bajo y explícito", () => {
    expect(MAX_ALTAS_POR_IP_24H).toBeLessThanOrEqual(10);
  });
});
