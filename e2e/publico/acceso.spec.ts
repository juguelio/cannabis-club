import { expect, test } from "../fixtures";
import { CRED } from "../env";
import { SEED as DATOS } from "../helpers";

test.describe("acceso", () => {
  test("el formulario pide email y contraseña, sin filtrar si el usuario existe", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ingresar", exact: true })).toBeVisible();
  });

  test("con la clave equivocada no entra y avisa", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(CRED.admin.email);
    await page.getByLabel("Contraseña", { exact: true }).fill("clave-que-no-es");
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();

    await expect(page.getByText("Email o contraseña incorrectos")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("un email que no existe recibe exactamente el mismo mensaje", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nadie@ejemplo.test");
    await page.getByLabel("Contraseña", { exact: true }).fill("OtraClave123!");
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();

    // Mismo texto que el caso anterior: desde afuera no se puede deducir quién tiene cuenta.
    await expect(page.getByText("Email o contraseña incorrectos")).toBeVisible();
  });

  test("una pantalla del club sin sesión manda al login", async ({ page }) => {
    await page.goto("/socios");
    await expect(page).toHaveURL(/\/login/);
  });

  test("el portal sin sesión manda al login", async ({ page }) => {
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/login/);
  });

  test("una dirección que no existe no rompe el servidor", async ({ page }) => {
    const resp = await page.goto("/esta-pantalla-no-existe");
    expect(resp?.status(), "no puede ser un error del servidor").toBeLessThan(500);
    await expect(page.locator("body")).not.toContainText(/Application error|Internal Server Error/);
    // Y no muestra nada del club: ni padrón, ni nombres, ni menú interno.
    await expect(page.locator("body")).not.toContainText(/Gómez|Legajo|Dispensario/);
  });
});

test.describe("sitio abierto", () => {
  test("la portada muestra el club", async ({ page }) => {
    const resp = await page.goto("/");
    expect(resp?.status()).toBe(200);
    await expect(page.locator("body")).toContainText(/rep[úu]blica/i);
  });

  test("la política de privacidad se lee sin cuenta", async ({ page }) => {
    const resp = await page.goto("/privacidad");
    expect(resp?.status()).toBe(200);
    await expect(page.locator("body")).toContainText(/privacidad|datos personales/i);
  });

  test("los términos del club están disponibles sin ingresar", async ({ page }) => {
    const resp = await page.goto("/terminos");
    expect(resp?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/términos/i);
  });

  test("el sitio informativo abre sin cuenta", async ({ page }) => {
    const resp = await page.goto("/sitio");
    expect(resp?.status()).toBe(200);
    await expect(page.locator("body")).toContainText(/REPROCANN|club/i);
  });

  test("la ficha pública de un lote cuenta su trazabilidad", async ({ page }) => {
    const resp = await page.goto(`/lote/${DATOS.lotes[0]}`);
    expect(resp?.status()).toBe(200);
    await expect(page.locator("body")).toContainText(DATOS.lotes[0]);
  });

  test("un lote inventado no muestra datos de nadie", async ({ page }) => {
    const resp = await page.goto("/lote/L-NO-EXISTE-999");
    expect([200, 404]).toContain(resp?.status() ?? 0);
    await expect(page.locator("body")).not.toContainText("L-2026-001");
  });
});
