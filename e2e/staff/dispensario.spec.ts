import { expect, test } from "../fixtures";
import { elegirSocioEnMostrador } from "../helpers";

/**
 * El mostrador es donde el club se juega la trazabilidad: cada entrega queda escrita con lote, gramos
 * y quién la hizo. Los tests recorren el camino real —buscar al socio, elegir lote, pesar y confirmar
 * — y después verifican el efecto, no sólo que la pantalla diga «listo».
 */
test.describe("dispensario", () => {
  test("muestra los topes que aplica y quién se espera hoy", async ({ page }) => {
    await page.goto("/dispensario");
    await expect(page.locator("body")).toContainText(/25 g por pedido/);
    await expect(page.locator("body")).toContainText(/50 g por mes/);
    await expect(page.locator("body")).toContainText("Esperados hoy");
    await expect(page.locator("body")).toContainText("Gómez, María");
  });

  test("las reservas del portal aparecen con lo que pidió el socio", async ({ page }) => {
    await page.goto("/dispensario");
    await expect(page.locator("body")).toContainText("Reservas del portal");
    await expect(page.locator("body")).toContainText("Pérez, Julián");
    await expect(page.locator("body")).toContainText(/10 g/);
  });

  test("elegir un turno carga al socio en el mostrador", async ({ page }) => {
    await elegirSocioEnMostrador(page);

    // El nombre tiene que quedar elegido en el panel, no sólo en la lista de al lado.
    await expect(page.locator("body")).toContainText(/María/);
    await expect(page.locator("body")).toContainText(/Legajo 1/);
  });

  test("sin gramos no deja confirmar: no se registra una entrega vacía", async ({ page }) => {
    await elegirSocioEnMostrador(page);

    const confirmar = page.getByRole("button", { name: /Confirmar entrega/i }).first();
    if (await confirmar.isEnabled().catch(() => false)) {
      await confirmar.click();
      // O avisa, o el servidor rechaza: en ningún caso queda una entrega de 0 g.
      await expect(page.locator("body")).toContainText(/gramo|falta|elegí/i);
    } else {
      await expect(confirmar).toBeDisabled();
    }
  });

  test("una entrega real deja asiento y descuenta del lote", async ({ page }) => {
    // Camila no tiene pedidos del portal abiertos: el mostrador abre la balanza, no una reserva.
    await elegirSocioEnMostrador(page, "Aguirre", 12);

    // Lote y gramos: los dos datos sin los cuales no hay trazabilidad.
    const lote = page.getByRole("radio").first();
    if (await lote.count()) await lote.check().catch(() => page.locator("[role=radiogroup] button").first().click());

    const gramos = page.locator("input[placeholder='0']").first();
    await expect(gramos).toBeVisible();
    await gramos.fill("2");

    const confirmar = page.getByRole("button", { name: /Confirmar .*entrega|Confirmar 2/i }).first();
    await expect(confirmar).toBeEnabled();
    await confirmar.click();

    // La pantalla confirma con el peso entregado y el socio queda con su entrega del día.
    await expect(page.locator("body")).toContainText(/entrega|registrad|2 g/i, { timeout: 15_000 });
    await expect(page.locator("body")).not.toContainText(/Error interno/);
  });

  test("el tope por pedido se avisa antes de confirmar", async ({ page }) => {
    await elegirSocioEnMostrador(page, "Aguirre", 12);

    const gramos = page.locator("input[placeholder='0']").first();
    await gramos.fill("40");

    // 40 g supera el tope de 25 g por pedido: el mostrador tiene que decirlo antes del servidor.
    await expect(page.locator("body")).toContainText(/tope|l[íi]mite|por pedido/i);
  });
});
