import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { firmarBaja, urlBaja, verificarBaja } from "../baja";

const original = { BAJA_SECRET: process.env.BAJA_SECRET, AUTH_SECRET: process.env.AUTH_SECRET };

beforeEach(() => {
  process.env.BAJA_SECRET = "secreto-de-baja-para-tests";
});
afterEach(() => {
  process.env.BAJA_SECRET = original.BAJA_SECRET;
  process.env.AUTH_SECRET = original.AUTH_SECRET;
});

describe("baja de la carta", () => {
  it("el link que se firma se puede verificar y devuelve el socio", () => {
    const token = firmarBaja("member_123");
    expect(token).toBeTruthy();
    expect(verificarBaja(token)).toEqual({ ok: true, memberId: "member_123" });
  });

  it("cambiar el id invalida el link: nadie da de baja a otro", () => {
    const token = firmarBaja("member_123")!;
    const [v, , sig] = token.split(".");
    const otro = Buffer.from("member_999", "utf8").toString("base64url");
    expect(verificarBaja(`${v}.${otro}.${sig}`)).toEqual({ ok: false, motivo: "firma" });
  });

  it("un link manoseado o de otro formato se rechaza sin romper", () => {
    expect(verificarBaja("cualquier cosa")).toEqual({ ok: false, motivo: "formato" });
    expect(verificarBaja("")).toEqual({ ok: false, motivo: "sin_token" });
    expect(verificarBaja(null)).toEqual({ ok: false, motivo: "sin_token" });
  });

  it("no caduca: un link viejo sigue sirviendo (una baja que expira no es una baja)", () => {
    const token = firmarBaja("member_123")!;
    // Mismo token, mucho después: no hay vencimiento embebido, la firma alcanza.
    expect(verificarBaja(token)).toEqual({ ok: true, memberId: "member_123" });
  });

  it("sin secreto configurado no se firma ni se acepta nada", () => {
    process.env.BAJA_SECRET = "";
    process.env.AUTH_SECRET = "";
    expect(firmarBaja("member_123")).toBeNull();
    expect(verificarBaja("v1.YWJj.ZGVm")).toEqual({ ok: false, motivo: "sin_secreto" });
    expect(urlBaja("member_123", "https://club.test")).toBeNull();
  });

  it("si no hay secreto propio usa el de la app", () => {
    process.env.BAJA_SECRET = "";
    process.env.AUTH_SECRET = "secreto-de-la-app-para-tests";
    const token = firmarBaja("member_123")!;
    expect(verificarBaja(token)).toEqual({ ok: true, memberId: "member_123" });
  });

  it("el link apunta al endpoint de baja y escapa el token", () => {
    const url = urlBaja("member_123", "https://club.test/")!;
    expect(url.startsWith("https://club.test/api/baja?t=")).toBe(true);
    const token = decodeURIComponent(url.split("t=")[1]);
    expect(verificarBaja(token)).toEqual({ ok: true, memberId: "member_123" });
  });
});
