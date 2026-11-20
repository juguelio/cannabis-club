import { expect, test as base } from "@playwright/test";

/**
 * Fixture que vigila la página.
 *
 * - **Excepción de JavaScript (`pageerror`)** → el test falla siempre. No hay excusa: si la app tira
 *   una excepción en el navegador, hay un bug, aunque la pantalla «se vea bien».
 * - **Errores de consola** → se juntan y quedan disponibles en `errores`. No fallan solos porque
 *   un 404 de una imagen o un `fetch` que se espera que falle también escriben ahí; cada test decide
 *   qué es aceptable, en vez de apagar el control para todos.
 */
export const test = base.extend<{ errores: string[] }>({
  errores: [
    async ({ page }, use) => {
      const errores: string[] = [];
      page.on("pageerror", (e) => errores.push(`EXCEPCIÓN: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const texto = m.text();
        if (/favicon|net::ERR_ABORTED|Failed to load resource/i.test(texto)) return;
        errores.push(texto);
      });
      await use(errores);
      expect(errores.filter((e) => e.startsWith("EXCEPCIÓN")), "la página no puede tirar excepciones").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
