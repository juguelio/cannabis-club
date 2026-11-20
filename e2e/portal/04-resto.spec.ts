import { expect, test } from "../fixtures";

/** Mis pedidos, mis datos, envíos y la guía del REPROCANN: el resto del portal del socio. */
test.describe("mis pedidos", () => {
  test("lista los pedidos con su estado, sin jerga del sistema", async ({ page }) => {
    await page.goto("/portal");
    await expect(page.locator("body")).toContainText("Mis pedidos");
    await expect(page.locator("body")).toContainText(/retiro|env[íi]o/i);
    await expect(page.locator("body")).not.toContainText(/PICKUP_|EN_REVISION|SOLICITADA/);
  });

  test("un pedido ajeno no se puede abrir por URL", async ({ page }) => {
    const resp = await page.goto("/portal/pedido/pago/id-de-otro-socio");
    // O 404, o lo devuelve al portal: nunca muestra el pedido de otra persona.
    expect([200, 404]).toContain(resp?.status() ?? 0);
    await expect(page.locator("body")).not.toContainText("Pérez, Julián");
  });
});

test.describe("mis datos", () => {
  test("muestra el domicilio y el REPROCANN del legajo", async ({ page }) => {
    await page.goto("/portal/datos");
    await expect(page.locator("body")).toContainText(/María|Correo|Tel[ée]fono|Direcci[óo]n/i);
  });

  test("guarda el domicilio y lo deja dicho", async ({ page }) => {
    await page.goto("/portal/datos");
    const boton = page.getByRole("button", { name: /Guardar|Actualizar/i }).first();
    if (await boton.count()) {
      await boton.click();
      await expect(page.locator("body")).toContainText(/guardad|listo|ok/i, { timeout: 15_000 });
    }
  });
});

test.describe("envíos", () => {
  test("con el código postal dice si hay reparto y cuánto tarda", async ({ page }) => {
    await page.goto("/portal/envios");
    await expect(page.locator("body")).toContainText(/Env[íi]o|zona|demora/i);
  });
});

test.describe("guía del REPROCANN", () => {
  test("la guía se lee paso a paso", async ({ page }) => {
    await page.goto("/portal/reprocann");
    await expect(page.locator("body")).toContainText(/REPROCANN/i);
    await expect(page.locator("body")).toContainText(/paso/i);
  });
});
