import type { MetadataRoute } from "next";
import { getBrandView } from "@/lib/brand-db";
import { clubNombre } from "@/lib/site";

/** Manifest del sitio: nombre, colores del club e íconos generados del monograma. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const view = await getBrandView();
  return {
    name: view.nombre,
    short_name: view.brand.sigla || view.nombre.slice(0, 12),
    description: view.brand.lema || `Gestión de socios, stock y registro de ${clubNombre()}: padrón, dispensario y libros.`,
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
