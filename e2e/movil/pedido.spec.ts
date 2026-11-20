import { expect, test } from "../fixtures";
import { irAlPago } from "../helpers";

/**
 * El socio hace el pedido desde el teléfono, que es donde lo hace de verdad. Mismo camino que en
 * escritorio, pero en 412 px de ancho: si algo se sale de la pantalla o el botón no se puede tocar,
 * el pedido no existe.
 */
test("el portal se usa en el celular sin desbordar", async ({ page }) => {
  await page.goto("/portal", { waitUntil: "networkidle" });
  await expect(page.locator("body")).toContainText(/Variedades disponibles/);
  await expect(page.locator("body")).toContainText(/en stock/);

  const ancho = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, visible: window.innerWidth }));
  expect(ancho.scroll, "la pantalla no puede ser más ancha que el teléfono").toBeLessThanOrEqual(ancho.visible + 2);
});

test("el pedido completo se puede hacer con el pulgar", async ({ page }) => {
  await irAlPago(page, "5 g", 4);

  // En el celular el comprobante se saca con la cámara: los dos botones tienen que estar.
  await expect(page.getByRole("button", { name: /Sacar una foto del comprobante/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Elegir una captura o un PDF del comprobante/i })).toBeVisible();
});
