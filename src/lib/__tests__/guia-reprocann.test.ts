import { describe, expect, it } from "vitest";
import {
  ESTADOS_TRABADOS,
  GUIA,
  INSTAGRAM_URL,
  NOTAS,
  PASOS,
  PROFESIONALES,
  TIEMPOS,
  pesos,
  whatsappGuia,
} from "../guia-reprocann";

describe("guía del REPROCANN", () => {
  it("los pesos se escriben como los escribe el club", () => {
    expect(pesos(60000)).toBe("$60.000");
    expect(pesos(40000)).toBe("$40.000");
  });

  it("todos los turnos salen por https y a un destino real", () => {
    for (const p of PROFESIONALES) {
      expect(p.url.startsWith("https://"), p.nombre).toBe(true);
      expect(p.nombre.length).toBeGreaterThan(3);
      expect(p.via.length).toBeGreaterThan(3);
    }
  });

  it("el WhatsApp se arma con el número del consultorio y el mensaje ya escrito", () => {
    const link = whatsappGuia();
    expect(link.startsWith(`https://wa.me/${GUIA.whatsapp}?text=`)).toBe(true);
    expect(decodeURIComponent(link)).toContain("REPROCANN");
    // Sin signos ni espacios: wa.me sólo acepta dígitos.
    expect(GUIA.whatsapp).toMatch(/^\d{10,15}$/);
  });

  it("el Instagram apunta al perfil del consultorio", () => {
    expect(INSTAGRAM_URL).toBe("https://www.instagram.com/codigoverde8");
  });

  it("los pasos están completos y en orden: sin huecos, el socio se traba", () => {
    expect(PASOS.length).toBeGreaterThanOrEqual(5);
    for (const p of PASOS) {
      expect(p.titulo.trim().length, "título").toBeGreaterThan(3);
      expect(p.texto.trim().length, p.titulo).toBeGreaterThan(20);
    }
    // El orden es el del trámite: primero el turno, al final la credencial.
    expect(PASOS[0].titulo).toContain("turno");
    expect(PASOS[PASOS.length - 1].titulo.toLowerCase()).toContain("credencial");
    // Aceptar los términos va antes de que el club vincule.
    const iAcepta = PASOS.findIndex((p) => p.titulo.includes("términos"));
    const iVincula = PASOS.findIndex((p) => p.titulo.includes("vincula"));
    expect(iAcepta).toBeGreaterThan(-1);
    expect(iVincula).toBeGreaterThan(iAcepta);
  });

  it("los cuatro estados trabados dicen qué hacer, no sólo cómo se llaman", () => {
    expect(ESTADOS_TRABADOS).toHaveLength(4);
    for (const e of ESTADOS_TRABADOS) {
      expect(e.estado.length).toBeGreaterThan(10);
      expect(e.queHacer.length, e.estado).toBeGreaterThan(20);
    }
    const estados = ESTADOS_TRABADOS.map((e) => e.estado).join(" | ");
    expect(estados).toContain("consentimiento del paciente");
    expect(estados).toContain("vinculación con cultivador");
  });

  it("los tiempos separan autocultivo de club: no son el mismo trámite", () => {
    expect(TIEMPOS).toHaveLength(2);
    expect(TIEMPOS.map((t) => t.tipo).join(" ")).toContain("club");
  });

  it("no publica un valor mientras el sitio y el consultorio no coincidan", () => {
    // Si algún día se publican, este test obliga a decidirlo a propósito y no de olvido.
    expect(typeof GUIA.publicarValores).toBe("boolean");
    expect(GUIA.publicarValores).toBe(false);
    expect(GUIA.valorConsultaArs).toBeGreaterThan(0);
    expect(GUIA.valorVinculacionArs).toBeGreaterThan(0);
  });

  it("la página dice que el trámite lo hace el socio y que el club no cobra", () => {
    expect(NOTAS.quienHaceElTramite).toContain("lo hace el socio");
    expect(NOTAS.quienHaceElTramite).toContain("no puede iniciarlo");
    expect(NOTAS.pago).toContain("El club no cobra");
    expect(NOTAS.control).toContain("6 meses");
  });
});
