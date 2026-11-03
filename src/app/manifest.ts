import type { MetadataRoute } from "next";
import { getBrandView } from "@/lib/brand-db";

/** Manifest del sitio: nombre, colores del club e íconos generados del monograma. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const view = await getBrandView();
  return {
    name: view.nombre,
    short_name: view.brand.sigla || "República",
    description: view.brand.lema || "Club de cultivo solidario con REPROCANN.",
    start_url: "/sitio",
    display: "standalone",
    background_color: view.brand.colores.claro,
    theme_color: view.brand.colores.oscuro,
    lang: "es-AR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
