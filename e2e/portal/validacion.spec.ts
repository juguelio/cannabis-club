import { expect, test } from "../fixtures";

test("Mis datos devuelve todos los errores y conserva la ayuda del código postal", async ({ page }) => {
  await page.goto("/portal/datos");
  const cp = page.getByLabel("Código postal", { exact: true });
  const telefono = page.getByLabel("Teléfono", { exact: true });
  await cp.fill("xxx");
  await telefono.fill("12");
  await page.getByRole("button", { name: "Guardar mis datos" }).click();
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(2);
  await expect(cp).toHaveAccessibleDescription(/Cuatro números.*código postal son 4 números/);
  await expect(telefono).toHaveAccessibleDescription(/teléfono no parece completo/);
  await telefono.fill("2944123456");
  await expect(telefono).not.toHaveAttribute("aria-invalid", "true");
  await expect(cp).toHaveAttribute("aria-invalid", "true");
});

test("el checkout de envío detalla qué falta en el domicilio", async ({ page }) => {
  await page.goto("/portal", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^5 g/ }).first().click();
  await page.goto("/portal/pedido");
  await page.getByRole("button", { name: /Envío a domicilio/ }).click();
  await page.getByRole("button", { name: "Cambiar", exact: true }).click();
  const cp = page.getByLabel("Código postal", { exact: true });
  const calle = page.getByLabel("Calle y número");
  await cp.fill("83");
  await calle.fill("A");
  await calle.press("Tab");
  await expect(cp).toHaveAccessibleDescription(/cuatro números/);
  await expect(calle).toHaveAccessibleDescription(/calle y número/);
  await expect(page.getByRole("button", { name: /Continuar al pago/ })).toBeDisabled();
});
