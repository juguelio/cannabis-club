import { describe, expect, it } from "vitest";
import {
  baseUrlDelFlujo,
  destinoDelFlujoGoogle,
  esHostDeLaApp,
  hostAutorizadoParaGoogle,
  origenDelPedido,
} from "../google-base";

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

  it("desde `.org.ar` la vuelta se queda en `.org.ar` aunque el canónico sea el alias de Vercel", () => {
    // En producción `APP_BASE_URL` es el alias de Vercel: sin esto, el `redirect_uri` cambiaba de
    // dominio, la cookie de `state` no viajaba y el ingreso moría en «el intento venció».
    expect(
      baseUrlDelFlujo({ origin: "https://republicacannabis.org.ar", host: "republicacannabis.org.ar" }, CANONICA),
    ).toBe("https://republicacannabis.org.ar");
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
    // `.org.ar` es el otro dominio del club: si no se reconoce, el ingreso arranca acá y vuelve por el canónico.
    expect(esHostDeLaApp("republicacannabis.org.ar")).toBe(true);
    expect(esHostDeLaApp("www.republicacannabis.org.ar")).toBe(true);
    expect(esHostDeLaApp("localhost:3300")).toBe(true);
    expect(esHostDeLaApp("cannabis-club-mauve.vercel.app")).toBe(true);
    // Trampas: un dominio que sólo contiene el nombre, o un Vercel de otro proyecto.
    expect(esHostDeLaApp("republicacannabis.com.ar.evil.test")).toBe(false);
    expect(esHostDeLaApp("republicacannabis.org.ar.evil.test")).toBe(false);
    // Preview con sufijo del team: sí es del proyecto.
    expect(esHostDeLaApp("cannabis-club-njji9hhpo-patagonia-sounds.vercel.app")).toBe(true);
    expect(esHostDeLaApp("otro.vercel.app")).toBe(false);
    expect(esHostDeLaApp("araucana.com.ar")).toBe(false);
  });
});

describe("hosts autorizados por Google", () => {
  const PROD = "https://republicacannabis.com.ar";
  const url = (origin: string) => ({ origin, host: new URL(origin).host });

  it("los tres que Google tiene cargados no dan salto", () => {
    for (const host of ["republicacannabis.com.ar", "www.republicacannabis.com.ar", "cannabis-club-mauve.vercel.app"]) {
      expect(hostAutorizadoParaGoogle(host, PROD)).toBe(true);
      expect(destinoDelFlujoGoogle({ origin: `https://${host}`, host }, PROD)).toBeNull();
    }
  });

  it("`.org.ar`, `www.org.ar`, el deploy con hash y el alias `-git-main-` saltan al canónico", () => {
    // Medido contra accounts.google.com el 26/11: esas cuatro respondían 400 redirect_uri_mismatch
    // (o cruzaban la cookie de `state` a otro host).
    for (const host of [
      "republicacannabis.org.ar",
      "www.republicacannabis.org.ar",
      "cannabis-club-cgsjjnwde-patagonia-sounds.vercel.app",
      "cannabis-club-git-main-patagonia-sounds.vercel.app",
    ]) {
      expect(hostAutorizadoParaGoogle(host, PROD)).toBe(false);
      expect(destinoDelFlujoGoogle({ origin: `https://${host}`, host }, PROD)).toBe(
        "https://republicacannabis.com.ar/api/auth/google",
      );
    }
  });

  it("el salto conserva los parámetros y no repite la barra del canónico", () => {
    expect(destinoDelFlujoGoogle(url("https://republicacannabis.org.ar?alta=1"), `${PROD}/`)).toBe(
      "https://republicacannabis.com.ar/api/auth/google?alta=1",
    );
  });

  it("en local no salta y con el canónico apagado no hay a dónde ir", () => {
    expect(destinoDelFlujoGoogle(url("http://localhost:3300"), "http://localhost:3300")).toBeNull();
    expect(destinoDelFlujoGoogle(url("https://republicacannabis.org.ar"), "")).toBeNull();
    expect(destinoDelFlujoGoogle(url("https://republicacannabis.org.ar"), null)).toBeNull();
  });

  it("si el canónico es el mismo host del pedido no rebota (sería un bucle)", () => {
    expect(destinoDelFlujoGoogle(url("https://raro.example"), "https://raro.example")).toBeNull();
  });

  it("el host de `APP_BASE_URL` cuenta como autorizado: es el canónico", () => {
    expect(hostAutorizadoParaGoogle("club-nuevo.test", "https://club-nuevo.test/")).toBe(true);
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
