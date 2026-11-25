import { expect, test } from "../fixtures";
import { elegirRetiro, irAlPago } from "../helpers";

/**
 * El pedido completo desde el celular del socio: elegir gramos, pasar por el basket, elegir retiro,
 * día y horario, y llegar al pago. Es el camino que hace el socio solo, sin que nadie del club lo guíe.
 */
test.describe("hacer el pedido", () => {
  test("sumar gramos los pone en el basket con su aporte", async ({ page }) => {
    await page.goto("/portal");
    await page.getByRole("button", { name: /^10 g/ }).first().click();

    await expect(page.locator("body")).toContainText(/10 g en tu basket|10 g de 50 g/);

    // El aporte se ve en el basket, que es donde el socio revisa antes de seguir.
    await page.goto("/portal/basket");
    await expect(page.locator("body")).toContainText(/\$ 12\.000|12\.000/);
  });

  test("no deja pasarse del tope por pedido desde el catálogo", async ({ page }) => {
    await page.goto("/portal", { waitUntil: "networkidle" });
    // 20 + 5 + 5 = 30 g, con tope de 25 g por pedido: el último toque no puede entrar callado.
    await page.getByRole("button", { name: /^20 g/ }).first().click();
    await page.getByRole("button", { name: /^5 g/ }).first().click();
    await page.getByRole("button", { name: /^5 g/ }).first().click();

    await expect(page.locator("body")).toContainText(/tope|m[áa]ximo|25 g/i);
  });

  test("el checkout pide la forma de entrega antes que nada", async ({ page }) => {
    await page.goto("/portal");
    await page.getByRole("button", { name: /^10 g/ }).first().click();
    await page.goto("/portal/pedido");

    await expect(page.locator("body")).toContainText("¿Cómo lo recibís?");
    await expect(page.getByRole("button", { name: /Retiro en el club/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Envío a domicilio/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /sucursal Andreani/ })).toBeVisible();
  });

  test("con retiro hay que elegir día y horario antes de pagar", async ({ page }) => {
    await page.goto("/portal");
    await page.getByRole("button", { name: /^10 g/ }).first().click();
    await page.goto("/portal/pedido");

    await elegirRetiro(page);
    await expect(page.getByRole("button", { name: /Continuar al pago/ })).toBeEnabled();
  });

  test("el pedido llega al pago con su número y su total", async ({ page }) => {
    await irAlPago(page, "5 g", 0);

    // En el pago están el monto y los datos para transferir: sin eso el socio no puede pagar.
    await expect(page.locator("body")).toContainText(/\$ 6\.000|6\.000/);
    await expect(page.locator("body")).toContainText(/Alias|CBU|transferencia/i);
  });
});
