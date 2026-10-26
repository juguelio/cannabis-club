import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { corteRetencion, elegiblesParaPurga, DIAS_RETENCION_RECHAZO } from "../retention-rules";
import { mailerConfigured, textoAprobado, textoRechazado } from "../mailer";

const hoy = new Date("2026-10-26T12:00:00Z");
const dias = (n: number) => new Date(hoy.getTime() - n * 24 * 3600 * 1000);

describe("retención de documentación", () => {
  it("el corte son 30 días atrás", () => {
    expect(DIAS_RETENCION_RECHAZO).toBe(30);
    expect(corteRetencion(hoy).toISOString()).toBe(dias(30).toISOString());
  });

  it("sólo se purga lo rechazado y con revisión vieja", () => {
    const lista = [
      { id: "vieja-rechazada", status: "RECHAZADA", reviewedAt: dias(31) },
      { id: "limite", status: "RECHAZADA", reviewedAt: dias(30) },
      { id: "reciente", status: "RECHAZADA", reviewedAt: dias(3) },
      { id: "pendiente", status: "PENDIENTE", reviewedAt: null },
      { id: "aprobada", status: "APROBADA", reviewedAt: dias(90) },
      { id: "sin-fecha", status: "RECHAZADA", reviewedAt: null },
    ];
    expect(elegiblesParaPurga(lista, hoy)).toEqual(["vieja-rechazada", "limite"]);
  });

  it("un socio aprobado no se toca nunca, por viejo que sea", () => {
    const lista = [{ id: "socio", status: "APROBADA", reviewedAt: dias(999) }];
    expect(elegiblesParaPurga(lista, hoy)).toEqual([]);
  });
});

describe("avisos por email", () => {
  const antes = { ...process.env };
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.CLUB_MAIL_FROM;
  });
  afterEach(() => {
    process.env = { ...antes };
  });

  it("sin clave ni remitente queda apagado (no rompe el alta)", () => {
    expect(mailerConfigured()).toBe(false);
  });

  it("con clave y remitente se considera configurado", () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.CLUB_MAIL_FROM = "República ONG <no-reply@club.test>";
    expect(mailerConfigured()).toBe(true);
  });

  it("el aviso de aprobación dice el legajo y a dónde entrar", () => {
    const texto = textoAprobado({ nombre: "María", legajo: 14, club: "República ONG", url: "https://club.test/login" });
    expect(texto).toContain("legajo es el 14");
    expect(texto).toContain("https://club.test/login");
    expect(texto).toContain("María");
  });

  it("el aviso de rechazo incluye el motivo tal cual", () => {
    const texto = textoRechazado({
      nombre: "María",
      motivo: "El DNI está ilegible",
      club: "República ONG",
      url: "https://club.test/login",
    });
    expect(texto).toContain("Motivo: El DNI está ilegible");
    expect(texto).toContain("volver a presentarla");
  });
});
