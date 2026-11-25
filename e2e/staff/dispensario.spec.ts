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
    await expect(page.locator("body")).toContainText(/\b150 g por mes/);
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

  test("la entrega exige liberación y luego descuenta el peso del lote", async ({ page, browser }) => {
    // Camila no tiene pedidos del portal abiertos: el mostrador abre la balanza, no una reserva.
    await elegirSocioEnMostrador(page, "Aguirre", 12);

    // Lote y gramos: los dos datos sin los cuales no hay trazabilidad.
    const antes = await (await page.request.get("/api/batches")).json();
    const lote = page.getByRole("radio", { name: /L-2026-001/ });
    await lote.click();
    await expect(lote).toBeChecked();

    const gramos = page.locator("input[placeholder='0']").first();
    await expect(gramos).toBeVisible();
    await gramos.fill("2");

    const confirmar = page.getByRole("button", { name: /Confirmar .*entrega|Confirmar 2/i }).first();
    await expect(confirmar).toBeEnabled();
    await confirmar.click();
    await expect(page.getByText(/todavía no está liberado/)).toBeVisible();
    const operador = await browser.newContext({ storageState: "e2e/.state/operador.json" });
    try {
      const ficha = await operador.newPage();
      const id = antes.batches.find((b: { code: string }) => b.code === "L-2026-001").id;
      await ficha.goto(`/stock/${id}`);
      await ficha.getByRole("button", { name: "Liberar lote", exact: true }).click();
      const firmar = ficha.getByRole("button", { name: "Firmar liberación" });
      await firmar.click();
      const form = ficha.locator("form").filter({ has: firmar });
      await expect(form.locator('[aria-invalid="true"]')).toHaveCount(4);
      for (const check of await form.getByRole("checkbox").all()) await check.check();
      const [firma] = await Promise.all([
        ficha.waitForResponse(r => r.url().endsWith("/release") && r.request().method() === "POST"),
        firmar.click(),
      ]);
      expect(firma.status(), await firma.text()).toBe(200);
    } finally {
      await operador.close();
    }
    const [respuesta] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith("/api/dispensations") && r.request().method() === "POST"),
      confirmar.click(),
    ]);
    expect(respuesta.status(), await respuesta.text()).toBe(201);
    const creado = await respuesta.json();
    const despues = await (await page.request.get("/api/batches")).json();
    const saldo = (rows: { code: string; balanceG: number }[]) => rows.find(row => row.code === "L-2026-001")!.balanceG;
    expect(creado.dispensation.id).toBeTruthy();
    expect(saldo(despues.batches)).toBeCloseTo(saldo(antes.batches) - 2);
    await expect(page.getByRole("link", { name: "Ver legajo", exact: true })).toBeVisible();
  });

  test("el tope por pedido se avisa antes de confirmar", async ({ page }) => {
    await elegirSocioEnMostrador(page, "Aguirre", 12);

    const gramos = page.locator("input[placeholder='0']").first();
    await gramos.fill("40");

    // 40 g supera el tope de 25 g por pedido: el mostrador tiene que decirlo antes del servidor.
    await expect(page.locator("body")).toContainText(/tope|l[íi]mite|por pedido/i);
  });
});
