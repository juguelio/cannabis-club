import { describe, expect, it } from "vitest";
import { MAX_BYTES, esHeic, validarArchivo } from "../comprobante-cliente";

describe("validar el comprobante antes de subirlo", () => {
  it("un JPG de tamaño normal pasa", () => {
    expect(validarArchivo("comprobante.jpg", "image/jpeg", 800_000)).toEqual({ ok: true });
  });

  it("un PDF pasa", () => {
    expect(validarArchivo("transferencia.pdf", "application/pdf", 120_000)).toEqual({ ok: true });
  });

  it("más de 6 MB se rechaza con el peso y qué hacer", () => {
    const r = validarArchivo("foto.jpg", "image/jpeg", MAX_BYTES + 1);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toContain("límite es 6 MB");
      expect(r.motivo).toContain("más chico");
    }
  });

  it("justo en 6 MB todavía entra (el límite es el del servidor)", () => {
    expect(validarArchivo("foto.jpg", "image/jpeg", MAX_BYTES)).toEqual({ ok: true });
  });

  it("un formato que no es foto ni PDF se rechaza diciendo cuáles sirven", () => {
    const r = validarArchivo("notas.txt", "text/plain", 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/JPG, PNG, WEBP\).? o PDF/);
  });

  it("un archivo vacío se rechaza", () => {
    expect(validarArchivo("foto.jpg", "image/jpeg", 0).ok).toBe(false);
  });

  it("HEIC pasa la validación porque se convierte en el navegador", () => {
    expect(esHeic("image/heic", "IMG_0001.HEIC")).toBe(true);
    expect(esHeic("", "IMG_0001.heif")).toBe(true);
    expect(validarArchivo("IMG_0001.HEIC", "image/heic", 2_000_000)).toEqual({ ok: true });
  });

  it("un tipo con parámetros (charset) se normaliza", () => {
    expect(validarArchivo("foto.png", "image/png; charset=binary", 1000)).toEqual({ ok: true });
  });
});
