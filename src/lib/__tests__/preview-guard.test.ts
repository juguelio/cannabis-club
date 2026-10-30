import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";
import { huellaBase } from "../db-fingerprint";

const prod = "postgresql://test:fake@production.example.test/main";
afterEach(() => vi.unstubAllEnvs());
describe("aislamiento de previews antes de ejecutar rutas", () => {
  it.each(["GET", "POST", "HEAD"])("bloquea %s contra la base productiva, incluido el callback OAuth", async (method) => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("DATABASE_URL", prod);
    vi.stubEnv("PROD_DB_FINGERPRINT", huellaBase(prod)!);
    const res = await proxy(new NextRequest("https://preview.example.test/api/auth/google/callback", { method }));
    expect(res.status).toBe(409);
  });
  it("sin huella configurada no supone que el entorno sea seguro", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PROD_DB_FINGERPRINT", "");
    expect((await proxy(new NextRequest("https://preview.example.test/login"))).status).toBe(503);
    expect((await proxy(new NextRequest("https://preview.example.test/api/health"))).status).toBe(200);
  });
  it("permite el login de un preview con base separada", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("DATABASE_URL", prod.replace("/main", "/preview"));
    vi.stubEnv("PROD_DB_FINGERPRINT", huellaBase(prod)!);
    expect((await proxy(new NextRequest("https://preview.example.test/login"))).status).toBe(200);
  });
  it("no bloquea producción con su propia huella", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("DATABASE_URL", prod);
    vi.stubEnv("PROD_DB_FINGERPRINT", huellaBase(prod)!);
    expect((await proxy(new NextRequest("https://club.example.test/login"))).status).toBe(200);
  });
});
