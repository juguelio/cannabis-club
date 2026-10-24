import type { NextConfig } from "next";

// App de gestión: todo depende de la base y de la sesión, no hay páginas estáticas que cachear.
const nextConfig: NextConfig = {
  cacheComponents: false,
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
