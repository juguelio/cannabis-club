import { describe, expect, it } from "vitest";
import nextConfig, { SECURITY_HEADERS } from "../../../next.config";

describe("cabeceras de seguridad", () => {
  it("no anuncia el framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("aplica las cabeceras base a todas las rutas", async () => {
    const reglas = await nextConfig.headers!();
    const todas = reglas.find((r) => r.source === "/:path*");
    expect(todas?.headers).toEqual(SECURITY_HEADERS);
    const h = Object.fromEntries(SECURITY_HEADERS.map((x) => [x.key, x.value]));
    expect(h["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
  });
});
