import { describe, expect, it } from "vitest";
import { copyAvisoVencimiento, diasHastaVencer, enVentanaDeAviso, episodioDeVencimiento, fechaLarga, textoAvisoVencimiento, tonoDeAviso } from "../avisos-rules";

/**
 * El aviso de vencimiento corre todos los días: si la ventana o el episodio están mal, el socio
 * recibe treinta mails iguales (y el club deja de leer la cola) o ninguno.
 */
const hoy = new Date("2026-11-01T12:00:00.000Z");

describe("aviso de vencimiento del REPROCANN", () => {
  it("cuenta los días por fecha, no por horas", () => {
    expect(diasHastaVencer(new Date("2026-11-30T00:00:00.000Z"), hoy)).toBe(29);
    expect(diasHastaVencer(new Date("2026-11-01T23:00:00.000Z"), hoy)).toBe(0);
    expect(diasHastaVencer(new Date("2026-10-28T00:00:00.000Z"), hoy)).toBe(-4);
    expect(diasHastaVencer(null, hoy)).toBe(null);
  });

  it("la ventana incluye el día del vencimiento y el borde del umbral", () => {
    expect(enVentanaDeAviso(30, 30)).toBe(true);
    expect(enVentanaDeAviso(0, 30)).toBe(true);
    expect(enVentanaDeAviso(31, 30)).toBe(false);
    expect(enVentanaDeAviso(-1, 30)).toBe(false);
    expect(enVentanaDeAviso(null, 30)).toBe(false);
  });

  it("el episodio es la fecha de vencimiento: dos corridas del mismo día son el mismo aviso", () => {
    const a = episodioDeVencimiento(new Date("2026-11-30T00:00:00.000Z"));
    const b = episodioDeVencimiento(new Date("2026-11-30T21:00:00.000Z"));
    expect(a).toBe("vence:2026-11-30");
    expect(a).toBe(b);
    expect(episodioDeVencimiento(new Date("2027-03-15T00:00:00.000Z"))).not.toBe(a);
  });

  it("el texto dice qué pasa y qué hacer, sin afirmar que ya venció", () => {
    const t = textoAvisoVencimiento({ nombre: "Ana", dias: 12, club: "República" });
    expect(t).toContain("Ana");
    expect(t).toContain("vence en 12 días");
    expect(t).toContain("República");
    expect(t).not.toContain("venció");
    expect(textoAvisoVencimiento({ nombre: "Ana", dias: 0, club: "República" })).toContain("vence hoy");
    expect(textoAvisoVencimiento({ nombre: "Ana", dias: 1, club: "República" })).toContain("vence mañana");
  });

  it("el tono cambia según cuánto falta: un mes informa, la última semana apura", () => {
    expect(tonoDeAviso(30)).toBe("mes");
    expect(tonoDeAviso(21)).toBe("mes");
    expect(tonoDeAviso(20)).toBe("cerca");
    expect(tonoDeAviso(1)).toBe("cerca");
    expect(tonoDeAviso(0)).toBe("hoy");
  });

  it("la fecha se escribe como la lee una persona, y no se corre por la zona horaria", () => {
    expect(fechaLarga(new Date("2026-12-30T00:00:00.000Z"))).toBe("30 de diciembre de 2026");
    // 23:00 UTC del 30 sigue siendo 30: se formatea en UTC, no en la zona del servidor.
    expect(fechaLarga(new Date("2026-12-30T23:00:00.000Z"))).toContain("30 de diciembre");
  });

  it("el aviso de un mes dice la fecha, qué pasa si vence y dónde se renueva", () => {
    const aviso = copyAvisoVencimiento({
      nombre: "Ana",
      dias: 30,
      club: "República",
      expira: new Date("2026-12-30T00:00:00.000Z"),
    });
    expect(aviso.asunto).toBe("Tu REPROCANN vence en un mes");
    expect(aviso.titulo).toBe("Tu REPROCANN vence en un mes");
    expect(aviso.destacado).toEqual({ etiqueta: "Vence", valor: "30 de diciembre de 2026" });
    expect(aviso.copete).toContain("Ana");
    expect(aviso.copete).toContain("30 de diciembre de 2026");
    const cuerpo = aviso.parrafos.join(" ");
    expect(cuerpo).toContain("bloquea");
    expect(cuerpo).toContain("REPROCANN");
    expect(cuerpo).toContain("portal del socio");
    // No se afirma que ya venció: todavía falta.
    expect(cuerpo).not.toContain("venció");
  });

  it("cuando faltan días el aviso apura y no promete un mes", () => {
    const aviso = copyAvisoVencimiento({ nombre: "Ana", dias: 3, club: "República", expira: new Date("2026-11-04T00:00:00.000Z") });
    expect(aviso.asunto).toBe("Tu REPROCANN vence en 3 días");
    expect(aviso.copete).toContain("quedan 3 días");
    expect(aviso.parrafos.join(" ")).not.toContain("con un mes");
  });

  it("el texto plano del aviso también lleva la fecha", () => {
    const t = textoAvisoVencimiento({ nombre: "Ana", dias: 30, club: "República", expira: new Date("2026-12-30T00:00:00.000Z") });
    expect(t).toContain("vence en 30 días");
    expect(t).toContain("30 de diciembre de 2026");
    expect(t).toContain("portal del socio");
  });
});
