import { expect, test } from "../fixtures";
import { BASE_URL } from "../env";
import { crearPedido, login, PNG_1X1 } from "../helpers";

/**
 * El tablero de pedidos es donde el club decide: si el comprobante está, se aprueba y el pedido pasa a
 * preparar. El pedido se arma como lo arma el socio —desde el portal, en su propio navegador— y después
 * se mira desde el club. Nada de llamar endpoints a mano: si el socio no puede pedir, este test lo dice.
 */
test.describe("tablero de pedidos", () => {
  test("lista los pedidos con su modalidad y su comprobante", async ({ page }) => {
    await page.goto("/pedidos");
    await expect(page.locator("body")).toContainText("Pérez, Julián");
    await expect(page.locator("body")).toContainText(/Retiro en el club/);
    await expect(page.locator("body")).toContainText(/sin comprobante/i);
  });

  test("los filtros separan retiros de envíos", async ({ page }) => {
    await page.goto("/pedidos");
    const todos = page.getByRole("button", { name: /^Todos/ });
    await expect(todos).toBeVisible();
    await todos.click();

    await page.getByRole("button", { name: /^Envíos/ }).click();
    await expect(page.locator("body")).not.toContainText("Pérez, Julián");
  });

  test("un pedido sin comprobante no se puede preparar", async ({ page }) => {
    await page.goto("/pedidos");
    await page.getByRole("button", { name: /Pérez, Julián/ }).first().click();

    await expect(page.locator("body")).toContainText(/todavía no subió el comprobante/i);
    await expect(page.getByRole("button", { name: /Aprobar y pasar a preparar/ })).toHaveCount(0);
  });

  test("el socio pide y sube el comprobante; el club lo aprueba", async ({ page, browser }) => {
    // 1) El socio hace su pedido en el portal, como en la vida real.
    // Los contextos del fixture heredan la sesión del proyecto: acá se pide uno limpio de verdad.
    const contexto = await browser.newContext({ baseURL: BASE_URL, storageState: { cookies: [], origins: [] } });
    const portal = await contexto.newPage();
    await login(portal, "socio");

    await portal.goto("/portal", { waitUntil: "networkidle" });
    const pedido = await crearPedido(portal);
    await portal.goto(`/portal/pedido/pago/${pedido}`, { waitUntil: "networkidle" });
    await portal.locator("input[type=file]").last().setInputFiles({ name: "comprobante.png", mimeType: "image/png", buffer: PNG_1X1 });
    await portal.getByRole("button", { name: /Subir comprobante/ }).click();
    await expect(portal).toHaveURL(/\/portal\/pedido\/listo\//, { timeout: 20_000 });
    await contexto.close();

    // 2) El club lo ve en el tablero ya en revisión y lo aprueba.
    await page.goto("/pedidos");
    // La fila con comprobante muestra el monto; la que no lo tiene dice «sin comprobante».
    await page.getByRole("button", { name: /Gómez, María/ }).filter({ hasText: /\$/ }).first().click();
    await expect(page.locator("body")).toContainText(/En revisión/);

    const aprobar = page.getByRole("button", { name: /Aprobar y pasar a preparar/ });
    await expect(aprobar).toBeVisible();
    await aprobar.click();

    await expect(page.locator("body")).toContainText(/Comprobante aprobado|aprobado/i, { timeout: 20_000 });
  });

  test("el comprobante se puede abrir para mirarlo, y queda auditado", async ({ page }) => {
    await page.goto("/pedidos");
    // La fila con comprobante muestra el monto; la que no lo tiene dice «sin comprobante».
    await page.getByRole("button", { name: /Gómez, María/ }).filter({ hasText: /\$/ }).first().click();

    const ver = page.getByRole("link", { name: /Ver el comprobante/ });
    await expect(ver).toBeVisible();
    await expect(page.locator("body")).toContainText(/Cada apertura queda auditada/i);
  });
});
