import { describe, expect, it } from "vitest";
import { cabecerasDeArchivo, MIMES_EN_LINEA, nombreDeArchivo } from "@/lib/file-headers";

/**
 * El comprobante se abre con `target="_blank"`: si la respuesta del PDF lleva `sandbox` en la CSP,
 * Chromium bloquea el visor y el club ve `ERR_BLOCKED_BY_CLIENT`. Estas pruebas fijan la regla.
 */
describe("cabecerasDeArchivo", () => {
  it("sirve el PDF en línea y sin sandbox (el visor de Chromium no corre en un sandbox)", () => {
    const h = cabecerasDeArchivo({ mime: "application/pdf", bytes: 1024, nombre: "comprobante.pdf" });
    expect(h["Content-Type"]).toBe("application/pdf");
    expect(h["Content-Disposition"]).toBe('inline; filename="comprobante.pdf"');
    expect(h["Content-Security-Policy"]).toBeUndefined();
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Cache-Control"]).toBe("no-store, private");
    expect(h["Content-Length"]).toBe("1024");
  });

  it("mantiene el sandbox en las imágenes", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
      const h = cabecerasDeArchivo({ mime, bytes: 10, nombre: nombreDeArchivo("dni", mime) });
      expect(h["Content-Type"]).toBe(mime);
      expect(h["Content-Security-Policy"]).toBe("default-src 'none'; sandbox");
      expect(h["Content-Disposition"]).toMatch(/^inline; filename="dni\.(jpg|png|webp)"$/);
    }
  });

  it("un mime fuera de la lista se sirve como descarga, nunca como página", () => {
    const h = cabecerasDeArchivo({ mime: "text/html", bytes: 10, nombre: "x.html" });
    expect(h["Content-Type"]).toBe("application/octet-stream");
    expect(h["Content-Disposition"]).toBe('attachment; filename="x.html"');
    expect(h["Content-Security-Policy"]).toBe("default-src 'none'; sandbox");
  });

  it("limpia comillas y saltos del nombre para no romper la cabecera", () => {
    const h = cabecerasDeArchivo({ mime: "application/pdf", bytes: 1, nombre: 'a"b\r\nc.pdf' });
    expect(h["Content-Disposition"]).toBe('inline; filename="abc.pdf"');
  });

  it("sin nombre usable no deja la cabecera vacía", () => {
    const h = cabecerasDeArchivo({ mime: "application/pdf", bytes: 1, nombre: '"""' });
    expect(h["Content-Disposition"]).toBe('inline; filename="archivo"');
  });

  it("la lista de mimes permitidos es la que se sirve en línea", () => {
    expect([...MIMES_EN_LINEA]).toEqual(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  });
});
