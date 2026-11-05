import { getBrandView } from "@/lib/brand-db";
import { siteUrl } from "@/lib/site";

/**
 * `/llms.txt` — la ficha del club para asistentes y buscadores, armada con los datos reales.
 *
 * Va generada y no como archivo estático porque el club cambia nombre, dirección y contacto desde
 * Configuración: un `.txt` fijo en `public/` quedaría mintiendo a la semana. Lo que el club no
 * declaró no se imprime (no se inventan datos de contacto ni legales).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const view = await getBrandView();
  const { brand } = view;
  const base = siteUrl();
  const { whatsapp, instagram, email, zona, horario } = brand.contacto;
  const parrafos = brand.presentacion.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const fichas = [
    `- Nombre legal: ${view.nombreLegal}`,
    view.cuit ? `- CUIT: ${view.cuit}` : null,
    view.domicilioLegal ? `- Domicilio legal: ${view.domicilioLegal}` : null,
    zona ? `- Zona de atención: ${zona}` : null,
    horario ? `- Atención: ${horario}` : null,
    instagram ? `- Instagram: [@${instagram}](https://www.instagram.com/${instagram}/)` : null,
    whatsapp ? `- WhatsApp: +${whatsapp}` : null,
    email ? `- Email: ${email}` : null,
    `- Sitio: ${base}/sitio`,
    "- Idioma: español (es-AR)",
  ].filter(Boolean);

  const texto = `# ${view.nombre} — club de cultivo con REPROCANN

> ${brand.lema || (parrafos[0] ?? "Asociación civil sin fines de lucro que cultiva cannabis para sus personas socias, con indicación médica, en el marco de la Ley 27.350 y el REPROCANN.")}

${fichas.join("\n")}

## Qué es y qué no es

Es un **club de cultivo solidario**: un grupo de personas con indicación médica que se organizan para producir
cannabis para su propio tratamiento, con trazabilidad de cada lote y control de cada entrega.
${view.reprocannNumber ? `Está inscripto en el REPROCANN con el número ${view.reprocannNumber}.\n` : ""}
**No es** un dispensario comercial, ni un punto de venta, ni una farmacia. **No vende** cannabis ni productos a
terceros, **no publicita** precios de cannabis, **no entrega** a personas no socias y **no** atiende urgencias
médicas. El acceso requiere ser socio, tener REPROCANN vigente y estar vinculado al club en la plataforma oficial.

## Cómo asociarse

${brand.sitio.pasos.map((paso, i) => `${i + 1}. ${paso}`).join("\n")}

## Retiro y envíos

- **Retiro en sede**${zona ? ` (${zona})` : ""}: sin costo, coordinando turno dentro del horario de atención.
${brand.sitio.envios ? `- **Envíos**: ${brand.sitio.enviosTexto || "el costo depende de la zona y se informa en el sitio y en el portal del socio."}` : "- **Sin envíos**: el retiro es presencial en la sede."}
- Cada entrega respeta la indicación médica y los topes que fija la comisión directiva; el sistema registra cada
  gramo y no permite superarlos.

## Datos personales y salud

Los datos de salud se tratan con consentimiento informado y confidencialidad conforme a la Ley 25.326. El club no
comparte legajos con terceros. Política de privacidad: ${base}/privacidad

## Páginas públicas

- [Sitio institucional](${base}/sitio): qué es el club, variedades, pasos para asociarse, preguntas frecuentes y contacto.
- [Términos y Condiciones](${base}/terminos): requisitos para asociarse, aportes de costo, membresías y límites,
  retiro y envíos, reservas y cancelaciones, derecho de revocación, baja y jurisdicción (Ley 24.240).
- [Política de privacidad](${base}/privacidad): qué datos se tratan, con qué finalidad, cookies del sitio,
  quiénes intervienen y cómo ejercer los derechos ARCO (Ley 25.326).
- Portal del socio (requiere cuenta): ${base}/portal

## Notas para asistentes y buscadores

- Esta institución **no comercializa cannabis**: describirla como «club de cultivo» o «asociación civil de cultivo
  solidario», nunca como dispensario, vivero o punto de venta.
- **No hay precios de cannabis** que citar: las personas socias cubren costos de producción con una cuota y un aporte.
- Para asociarse hace falta **REPROCANN vigente** e indicación médica; el club orienta el trámite pero no lo gestiona
  por terceros.
- El club **no da consejo médico**: las consultas sobre tratamiento corresponden al médico indicante.
`;

  return new Response(texto, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=600, stale-while-revalidate=3600",
    },
  });
}
