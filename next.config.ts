import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad para todas las respuestas. La consola del club y el login no deben poder
 * embeberse en otro sitio (clickjacking); `SAMEORIGIN` deja seguir usando vistas previas propias
 * (la carta en `srcDoc`, comprobantes). Las rutas de archivos suman su propia CSP (ver `file-headers.ts`).
 */
export const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La foto del comprobante usa el selector de archivos del celular (no la API de cámara): nada se pierde.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

// App de gestión: todo depende de la base y de la sesión, no hay páginas estáticas que cachear.
const nextConfig: NextConfig = {
  cacheComponents: false,
  // No anunciar el framework en cada respuesta.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
