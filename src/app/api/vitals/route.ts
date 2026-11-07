import { z } from "zod";

/**
 * Métricas de velocidad de usuarios reales (Web Vitals). No se guardan en la base ni salen a terceros:
 * quedan en los logs de Vercel como una línea JSON por métrica, para filtrar por `evento:"web_vital"`.
 * Pública a propósito (también mide /login y /sitio); acepta sólo este formato y descarta lo demás.
 */
const Metric = z.object({
  name: z.enum(["LCP", "INP", "CLS", "FCP", "TTFB", "FID"]),
  value: z.number().finite().min(0).max(120000),
  rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
  route: z.string().max(120).regex(/^\/[\w\-/:.]*$/),
  nav: z.string().max(30).optional(),
  w: z.number().int().min(0).max(10000).optional(),
});

export async function POST(req: Request) {
  const text = await req.text().catch(() => "");
  if (text.length > 1000) return new Response(null, { status: 413 });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const m = Metric.safeParse(data);
  if (!m.success) return new Response(null, { status: 400 });
  console.info(JSON.stringify({ evento: "web_vital", ...m.data, movil: m.data.w != null ? m.data.w < 768 : undefined }));
  return new Response(null, { status: 204 });
}
