import { describe, expect, it } from "vitest";
import { LOGO_URL, plantillaEmail } from "../email-template";

describe("plantilla de email", () => {
  const base = { titulo: "Tu alta quedó aprobada", parrafos: ["Hola: ya está."] };

  it("escapa lo que escribe el club", () => {
    const html = plantillaEmail({ ...base, destacado: { etiqueta: "Motivo", valor: "<script>alert(1)</script>" } });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("no depende de recursos externos más que el logo del propio dominio", () => {
    const html = plantillaEmail(base);
    const urls = html.match(/https?:\/\/[^"'\s<>)]+/g) ?? [];
    const externas = urls.filter((u) => !u.startsWith(LOGO_URL) && !u.startsWith("https://republicacannabis.com.ar"));
    expect(externas).toEqual([]);
    // Sin <style> ni fuentes web: los clientes de correo las tiran.
    expect(html).not.toContain("<style");
    expect(html).not.toContain("@import");
    expect(html).not.toContain("@font-face");
  });

  it("usa las letras y la paleta de la marca con sustituto", () => {
    // Con destacado y CTA, porque los colores de acento sólo aparecen en esos bloques.
    const html = plantillaEmail({
      ...base,
      destacado: { etiqueta: "Tu legajo", valor: "N.º 24" },
      cta: { texto: "Entrar", url: "https://club.test/portal" },
    });
    expect(html).toContain("Bricolage Grotesque");
    expect(html).toContain("Instrument Sans");
    expect(html).toContain("#10231b"); // pino, cabecera y pie
    expect(html).toContain("#1f5a3f"); // hoja, el botón
    expect(html).toContain("#5a33a3"); // antocianina, el dato destacado
  });

  it("arma el botón sólo si hay CTA, con la url absoluta", () => {
    const sin = plantillaEmail(base);
    expect(sin).not.toContain("<a href=\"https://club.test/portal\"");
    const con = plantillaEmail({ ...base, cta: { texto: "Entrar", url: "https://club.test/portal" } });
    expect(con).toContain('href="https://club.test/portal"');
  });

  it("el encabezado sale en mayúscula y el copete va en el preheader", () => {
    const html = plantillaEmail({ ...base, copete: "Bajada corta" });
    expect(html).toContain("text-transform:uppercase");
    expect(html).toContain("Bajada corta");
  });

  it("queda chico: no infla el mail", () => {
    expect(plantillaEmail({ ...base, parrafos: ["a", "b", "c"] }).length).toBeLessThan(12000);
  });
});
