import { describe, expect, it } from "vitest";
import { baseUrlDelFlujo, esHostDeLaApp, origenDelPedido } from "../google-base";

const CANONICA = "https://cannabis-club-mauve.vercel.app";

describe("base del ingreso con Google", () => {
  it("el dominio propio manda: la vuelta tiene que caer en el host que pidió", () => {
    expect(
      baseUrlDelFlujo({ origin: "https://republicacannabis.com.ar", host: "republicacannabis.com.ar" }, CANONICA),
    ).toBe("https://republicacannabis.com.ar");
  });

  it("con www también: para una cookie www y sin www son hosts distintos", () => {
    expect(
      baseUrlDelFlujo({ origin: "https://www.republicacannabis.com.ar", host: "www.republicacannabis.com.ar" }, CANONICA),
    ).toBe("https://www.republicacannabis.com.ar");
  });

  it("el deploy de Vercel sirve para probar y no se pisa con el canónico", () => {
    expect(
      baseUrlDelFlujo({ origin: "https://cannabis-club-abc123-patagonia-sounds.vercel.app", host: "cannabis-club-abc123-patagonia-sounds.vercel.app" }, CANONICA),
    ).toBe("https://cannabis-club-abc123-patagonia-sounds.vercel.app");
  });

  it("en local se respeta el puerto y el host que se usó", () => {
    expect(baseUrlDelFlujo({ origin: "http://127.0.0.1:3401", host: "127.0.0.1:3401" }, "http://localhost:3300")).toBe(
      "http://127.0.0.1:3401",
    );
  });

  it("un host ajeno no elige la vuelta: se usa el canónico", () => {
    expect(baseUrlDelFlujo({ origin: "https://evil.example", host: "evil.example" }, CANONICA)).toBe(CANONICA);
  });

  it("sin canónico configurado, cae al host del pedido (y no queda una base vacía)", () => {
    expect(baseUrlDelFlujo({ origin: "https://evil.example", host: "evil.example" }, "")).toBe("https://evil.example");
    expect(baseUrlDelFlujo({ origin: "https://evil.example", host: "evil.example" }, null)).toBe("https://evil.example");
  });

  it("no deja barra final duplicada", () => {
    expect(baseUrlDelFlujo({ origin: "https://republicacannabis.com.ar/", host: "republicacannabis.com.ar" }, "https://x/")).toBe(
      "https://republicacannabis.com.ar",
    );
    expect(baseUrlDelFlujo({ origin: "https://evil.example", host: "evil.example" }, "https://canonico.test/")).toBe(
      "https://canonico.test",
    );
  });

  it("reconoce los hosts de la app y descarta los parecidos", () => {
    expect(esHostDeLaApp("republicacannabis.com.ar")).toBe(true);
    expect(esHostDeLaApp("www.republicacannabis.com.ar")).toBe(true);
    expect(esHostDeLaApp("localhost:3300")).toBe(true);
    expect(esHostDeLaApp("cannabis-club-mauve.vercel.app")).toBe(true);
    // Trampas: un dominio que sólo contiene el nombre, o un Vercel de otro proyecto.
    expect(esHostDeLaApp("republicacannabis.com.ar.evil.test")).toBe(false);
    // Preview con sufijo del team: sí es del proyecto.
    expect(esHostDeLaApp("cannabis-club-njji9hhpo-patagonia-sounds.vercel.app")).toBe(true);
    expect(esHostDeLaApp("otro.vercel.app")).toBe(false);
    expect(esHostDeLaApp("araucana.com.ar")).toBe(false);
  });
});

describe("origen del pedido", () => {
  const H = (pares: Record<string, string>) => new Headers(pares);

  it("prefiere los headers del proxy: `req.url` viene con el host interno", () => {
    const url = new URL("http://localhost:3000/api/auth/google");
    const o = origenDelPedido(url, H({ "x-forwarded-host": "republicacannabis.com.ar", "x-forwarded-proto": "https" }));
    expect(o.origin).toBe("https://republicacannabis.com.ar");
    expect(o.host).toBe("republicacannabis.com.ar");
  });

  it("conserva el puerto del host real en local", () => {
    const url = new URL("http://localhost:3401/api/auth/google");
    const o = origenDelPedido(url, H({ host: "127.0.0.1:3401" }));
    expect(o).toEqual({ origin: "http://127.0.0.1:3401", host: "127.0.0.1:3401" });
  });

  it("toma el primer valor si el proxy encadena varios hosts", () => {
    const o = origenDelPedido(new URL("http://x/"), H({ "x-forwarded-host": "republicacannabis.com.ar, interno:3000" }));
    expect(o.host).toBe("republicacannabis.com.ar");
  });
});
