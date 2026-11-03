import type { MetadataRoute } from "next";

const SITE = "https://republicacannabis.com.ar";

/**
 * La consola del club y el portal del socio no se indexan (tienen datos de salud de personas).
 * Sólo el sitio público y la política de privacidad son rastreables, y también para los bots de IA:
 * que un modelo pueda leer y citar la información institucional es parte del objetivo.
 */
const PRIVADAS = [
  "/api/",
  "/portal",
  "/login",
  "/solicitud",
  "/cuenta",
  "/socios",
  "/stock",
  "/dispensario",
  "/turnos",
  "/calendario",
  "/avisos",
  "/traslados",
  "/aportes",
  "/control",
  "/reportes",
  "/inspeccion",
  "/cierre",
  "/cierre-mensual",
  "/informe-semestral",
  "/configuracion",
];

const PUBLICAS = ["/sitio", "/terminos", "/privacidad", "/llms.txt"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: PUBLICAS, disallow: PRIVADAS },
      // Bots de respuesta (ChatGPT, Claude, Perplexity, Gemini, Apple): mismas reglas, explícitas.
      {
        userAgent: [
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-Web",
          "anthropic-ai",
          "PerplexityBot",
          "Google-Extended",
          "Applebot-Extended",
          "CCBot",
          "Meta-ExternalAgent",
        ],
        allow: PUBLICAS,
        disallow: PRIVADAS,
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
