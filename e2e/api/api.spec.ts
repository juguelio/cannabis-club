import { expect, test } from "@playwright/test";
import { CRED } from "../env";

/**
 * La API se prueba por HTTP directo: sin navegador no hay nada que «se vea bien» por error.
 * Lo que se busca acá es lo que nunca se nota mirando la pantalla: que no se pueda entrar sin
 * sesión, que el health no cuente de más y que el login no diga quién existe.
 */

test.describe("health", () => {
  test("responde ok y la base está viva", async ({ request }) => {
    const resp = await request.get("/api/health");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe(true);

    // La huella identifica la base sin exponerla: 12 caracteres y nada de credenciales.
    expect(body.huella).toMatch(/^[0-9a-f]{12}$/);
    const crudo = await resp.text();
    expect(crudo).not.toMatch(/postgres(ql)?:\/\//i);
    expect(crudo).not.toContain("pooler");
  });

  test("no dice de qué entorno es la base por accidente", async ({ request }) => {
    const body = await (await request.get("/api/health")).json();
    expect(["local", "production", "preview", "development"]).toContain(body.entorno);
  });
});

test.describe("sin sesión", () => {
  const cerrados = [
    "/api/members",
    "/api/batches",
    "/api/portal/overview",
    "/api/dispensations",
    "/api/audit",
    "/api/reports/movimientos",
  ];

  for (const ruta of cerrados) {
    test(`${ruta} contesta 401 y no filtra datos`, async ({ request }) => {
      const resp = await request.get(ruta);
      expect(resp.status()).toBe(401);
      const body = await resp.json();
      expect(body.error).toBe("UNAUTHORIZED");
      expect(JSON.stringify(body)).not.toMatch(/@correo\.test|legajo|dsn/i);
    });
  }
});

test.describe("login por API", () => {
  test("credenciales malas dan 401 con el mismo mensaje siempre", async ({ request }) => {
    const existe = await request.post("/api/auth/login", {
      data: { email: CRED.admin.email, password: "no-es-la-clave" },
    });
    const noExiste = await request.post("/api/auth/login", {
      data: { email: "fantasma@ejemplo.test", password: "no-es-la-clave" },
    });

    expect(existe.status()).toBe(401);
    expect(noExiste.status()).toBe(401);
    expect((await existe.json()).message).toBe((await noExiste.json()).message);
  });

  test("un email con formato inválido se rechaza antes de tocar la base", async ({ request }) => {
    const resp = await request.post("/api/auth/login", { data: { email: "no-es-un-email", password: "123456" } });
    expect(resp.status()).toBe(400);
  });

  test("entra, tiene sesión y la puede cerrar", async ({ request }) => {
    const login = await request.post("/api/auth/login", {
      data: { email: CRED.socio.email, password: CRED.socio.password },
    });
    expect(login.status()).toBe(200);
    expect((await login.json()).user.role).toBe("SOCIO");

    // Con la cookie puesta, la API del portal responde.
    const portal = await request.get("/api/portal/overview");
    expect(portal.status()).toBe(200);

    await request.post("/api/auth/logout");
    const despues = await request.get("/api/portal/overview");
    expect(despues.status()).toBe(401);
  });
});
