import { describe, expect, it } from "vitest";
import { cabecerasBaja, plantillaCarta, textoCarta, type CartaClub } from "../carta-template";
import { LOGO_URL } from "../email-brand";

const carta: CartaClub = {
  edicion: "Carta del club · noviembre 2026",
  titulo: "El mes en que el club se ordena",
  copete: "Lo que cambió este mes.",
  apertura: ["Primer párrafo."],
  bloques: [
    { titulo: "Tu REPROCANN", texto: "Renovalo antes de que venza.", enlace: { texto: "Ver legajo", url: "https://club.test/portal" } },
    { titulo: "Envíos", texto: "Salen por Andreani." },
  ],
  cta: { texto: "Entrar al portal", url: "https://club.test/portal" },
  baja: "Si no querés recibirla, respondé este correo.",
};

describe("carta del club", () => {
  it("lleva edición, titular y los bloques en orden", () => {
    const html = plantillaCarta(carta);
    expect(html).toContain("Carta del club · noviembre 2026");
    expect(html).toContain("El mes en que el club se ordena");
    expect(html.indexOf("Tu REPROCANN")).toBeLessThan(html.indexOf("Envíos"));
  });

  it("la edición no se repite en la cabecera: la píldora es el único lugar", () => {
    const html = plantillaCarta(carta);
    const veces = html.split("Carta del club · noviembre 2026").length - 1;
    expect(veces).toBe(1);
  });

  it("no baja recursos de afuera: la única imagen es el logo del propio dominio", () => {
    const html = plantillaCarta(carta);
    const imagenes = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    expect(imagenes).toEqual([LOGO_URL]);
    // Los links a otros lados están bien; lo que no puede haber es CSS ni fuentes externas.
    expect(html).not.toContain("<style");
    expect(html).not.toContain("@font-face");
    expect(html).not.toContain("<link");
  });

  it("escapa lo que escribe el operador", () => {
    const html = plantillaCarta({ ...carta, titulo: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("la baja está siempre: es un correo al padrón, no un aviso de trámite", () => {
    expect(plantillaCarta(carta)).toContain("respondé este correo");
    expect(textoCarta(carta)).toContain("respondé este correo");
  });

  it("el texto plano lleva los mismos links que el HTML", () => {
    const t = textoCarta(carta);
    expect(t).toContain("https://club.test/portal");
    expect(t).toContain("TU REPROCANN");
    expect(t).toContain("ENVÍOS");
  });

  it("sin CTA no se dibuja el botón, pero la carta se arma igual", () => {
    const html = plantillaCarta({ ...carta, cta: undefined });
    expect(html).not.toContain("Entrar al portal");
    expect(html).toContain("El mes en que el club se ordena");
  });

  it("con link firmado la baja es de un click; sin link, se pide responder", () => {
    const conLink = plantillaCarta({ ...carta, bajaUrl: "https://club.test/api/baja?t=v1.abc.def" });
    expect(conLink).toContain("Darte de baja de la carta");
    expect(conLink).toContain("api/baja?t=v1.abc.def");
    expect(textoCarta({ ...carta, bajaUrl: "https://club.test/api/baja?t=v1.abc.def" })).toContain("Darte de baja: https://club.test/api/baja?t=v1.abc.def");
    // Sin link no se inventa un botón que no lleva a ningún lado.
    expect(plantillaCarta(carta)).not.toContain("Darte de baja de la carta");
  });

  it("las cabeceras de baja son las que piden Gmail y Apple Mail", () => {
    expect(cabecerasBaja("https://club.test/api/baja?t=x")).toEqual({
      "List-Unsubscribe": "<https://club.test/api/baja?t=x>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("no publica precios: eso es configuración del club y va en el portal", () => {
    const html = plantillaCarta(carta);
    expect(html).not.toMatch(/\$\s?\d/);
  });
});
