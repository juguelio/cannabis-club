import { expect, test } from "../fixtures";

test("login vacío muestra los dos campos y permite corregir uno por vez", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "2 campos" })).toContainText("2 campos");
  const email = page.getByLabel("Email");
  await expect(email).toBeFocused();
  await expect(email).toHaveAccessibleDescription("Completá este campo.");
  await email.fill("demo@club.test");
  await expect(email).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("aria-invalid", "true");
});

test("una desconexión en el login tiene explicación general y permite reintentar", async ({ page }) => {
  await page.goto("/login");
  await page.route("**/api/auth/login", route => route.abort("internetdisconnected"));
  await page.getByLabel("Email").fill("operador@club.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("Operador1234!");
  const entrar = page.getByRole("button", { name: "Ingresar", exact: true });
  await entrar.click();
  await expect(page.getByRole("alert").filter({ hasText: "Sin conexión con el servidor" })).toContainText("Sin conexión con el servidor");
  await expect(page.locator('[aria-invalid=true]')).toHaveCount(0);
  await page.unroute("**/api/auth/login");
  await entrar.click();
  await expect(page).toHaveURL(/\/$/);
});
