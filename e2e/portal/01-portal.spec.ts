import { expect, test } from "../fixtures";

/**
 * La pantalla del socio con el legajo ya verificado: lo primero que ve, su saldo del mes, su carnet y
 * el catálogo con el aporte de cultivo.
 */
test.describe("portal", () => {
  test("saluda al socio y le dice cuánto le queda este mes", async ({ page }) => {
    await page.goto("/portal");
    await expect(page.locator("body")).toContainText("Portal del socio");
    await expect(page.locator("body")).toContainText("María");
    await expect(page.locator("body")).toContainText(/Te quedan este mes/i);
    await expect(page.locator("body")).toContainText(/de \d+ g/);
  });

  test("muestra el estado del REPROCANN con su vencimiento", async ({ page }) => {
    await page.goto("/portal");
    await expect(page.locator("body")).toContainText(/REPROCANN/);
    await expect(page.locator("body")).toContainText(/Vigente|vence/i);
  });

  test("el catálogo muestra el aporte por gramo y sólo lo que hay", async ({ page }) => {
    await page.goto("/portal");
    await expect(page.locator("body")).toContainText(/Aporte de cultivo/i);
    await expect(page.locator("body")).toContainText("Lemon Haze");
    await expect(page.locator("body")).toContainText(/en stock/);
    await expect(page.getByRole("button", { name: /^5 g/ }).first()).toBeVisible();
  });

  test("filtrar por tipo de variedad cambia la lista", async ({ page }) => {
    await page.goto("/portal");
    await page.getByRole("button", { name: "Índica", exact: true }).click();
    await expect(page.getByRole("button", { name: "Índica", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("body")).toContainText("Northern Lights");
  });

  test("el basket arranca vacío y lo dice", async ({ page }) => {
    await page.goto("/portal/basket");
    await expect(page.locator("body")).toContainText(/Basket|basket/i);
    await expect(page.locator("body")).toContainText(/vac[íi]o|0 g/i);
  });

  test("un legajo verificado no vuelve a ver el trámite del REPROCANN", async ({ page }) => {
    await page.goto("/portal");
    await expect(page.locator("body")).not.toContainText("Empecemos por tu REPROCANN");
  });
});
