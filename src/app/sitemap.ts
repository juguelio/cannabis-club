import type { MetadataRoute } from "next";

const SITE = "https://republicacannabis.com.ar";

/** Lo indexable es poco y es a propósito: el sitio público y la política de privacidad. */
export default function sitemap(): MetadataRoute.Sitemap {
  const hoy = new Date();
  return [
    { url: `${SITE}/sitio`, lastModified: hoy, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/terminos`, lastModified: hoy, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE}/privacidad`, lastModified: hoy, changeFrequency: "yearly", priority: 0.4 },
  ];
}
