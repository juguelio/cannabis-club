import { describe, expect, it } from "vitest";
import { comoSalir, navegadorIntegrado } from "../navegador-integrado";

/**
 * El ingreso con Google no anda en los navegadores integrados: Google lo bloquea (`disallowed_useragent`).
 * Detectar el WebView no arregla el bloqueo, pero evita que el socio crea que el club le negó el acceso.
 */
const UAS = {
  instagramAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-A536B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.193 Mobile Safari/537.36 Instagram 311.0.0.32.117 Android",
  instagramIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 311.0.0.32.117 (iPhone14,5; iOS 17_1; es_AR; es; scale=3.00; 1170x2532; 623717105)",
  facebookAndroid:
    "Mozilla/5.0 (Linux; Android 12; SM-G991B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.5993.111 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/430.0.0.30.118;]",
  tiktok: "Mozilla/5.0 (Linux; Android 13; SM-A536B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.193 Mobile Safari/537.36 trill_311504 BytedanceWebview/d8a21c6 musical_ly_2023105040J",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.193 Mobile Safari/537.36",
  safariIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
  chromeDesktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
};

describe("navegador integrado", () => {
  it("reconoce Instagram y lo nombra", () => {
    expect(navegadorIntegrado(UAS.instagramAndroid)).toEqual({ integrado: true, app: "Instagram" });
    expect(navegadorIntegrado(UAS.instagramIOS)).toEqual({ integrado: true, app: "Instagram" });
  });

  it("reconoce Facebook, TikTok y el WebView genérico de Android", () => {
    expect(navegadorIntegrado(UAS.facebookAndroid).app).toBe("Facebook");
    expect(navegadorIntegrado(UAS.tiktok).app).toBe("TikTok");
    expect(navegadorIntegrado("Mozilla/5.0 (Linux; Android 11; SM-A105M Build/QP1A; wv) AppleWebKit/537.36").app).toBe(
      "el navegador de otra app",
    );
  });

  it("no marca los navegadores de verdad", () => {
    for (const ua of [UAS.chromeAndroid, UAS.safariIOS, UAS.chromeDesktop])
      expect(navegadorIntegrado(ua)).toEqual({ integrado: false, app: null });
  });

  it("un UA vacío no rompe", () => {
    expect(navegadorIntegrado("")).toEqual({ integrado: false, app: null });
  });
});

describe("cómo salir del WebView", () => {
  it("en iOS no hay intent: se copia el link y se abre Safari", () => {
    const r = comoSalir(true, "https://republicacannabis.com.ar/login?alta=1");
    expect(r.intent).toBeNull();
    expect(r.texto).toMatch(/Safari/);
  });

  it("en Android ofrece abrir Chrome con el mismo camino y query", () => {
    const r = comoSalir(false, "https://republicacannabis.com.ar/login?alta=1");
    expect(r.intent).toBe(
      "intent://republicacannabis.com.ar/login?alta=1#Intent;scheme=https;package=com.android.chrome;end",
    );
  });
});
