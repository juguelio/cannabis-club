import { expect, test } from "../fixtures";
import { SEED } from "../helpers";

/**
 * El stock es plata y trazabilidad: cada lote con su código, su saldo y su origen. Se prueba que
 * cada lote esté, que su ficha muestre el libro y que la etiqueta se pueda imprimir.
 */
test.describe("lotes", () => {
  test("lista los lotes del club con su variedad y su saldo", async ({ page }) => {
    await page.goto("/stock");
    for (const codigo of SEED.lotes) {
      await expect(page.locator("body")).toContainText(codigo);
    }
    await expect(page.locator("body")).toContainText(/Lemon Haze|Northern Lights|CBD Therapy/);
  });

  test("la ficha del lote cuenta de dónde viene y qué le pasó", async ({ page }) => {
    await page.goto("/stock");
    await page.getByRole("link", { name: /L-2026-002/ }).first().click();

    await expect(page.locator("h1")).toContainText(/L-2026-002/);
    await expect(page.locator("body")).toContainText(/Origen|Esqueje|Semilla/i);
    await expect(page.locator("body")).toContainText(/Movimiento|Libro|Saldo/i);
  });

  test("la etiqueta del lote se imprime con su código", async ({ page }) => {
    await page.goto("/stock");
    await page.getByRole("link", { name: /L-2026-001/ }).first().click();

    const etiqueta = page.getByRole("link", { name: /Etiqueta|Imprimir/i }).first();
    await etiqueta.click();
    await expect(page.locator("body")).toContainText("L-2026-001");
  });

  test("un lote que no existe no rompe la pantalla", async ({ page }) => {
    const resp = await page.goto("/stock/no-existe-777");
    expect([200, 404]).toContain(resp?.status() ?? 0);
    await expect(page.locator("body")).not.toContainText(/Application error|Internal Server Error/);
  });

  test("el botón de nuevo lote abre el formulario", async ({ page }) => {
    await page.goto("/stock");
    const nuevo = page.getByRole("button", { name: /Nuevo lote/i }).first();
    await nuevo.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(/Variedad|Plantas|Origen/i);
  });
});
