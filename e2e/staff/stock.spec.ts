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
    await expect(page.getByRole("heading", { name: "Estado del lote" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Secciones del lote" });
    await nav.getByRole("link", { name: "Cultivo" }).click();
    await expect(page.locator("body")).toContainText(/Origen|Esqueje|Semilla/i);
    await nav.getByRole("link", { name: "Movimientos" }).click();
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

test("galería interna del lote: agregar, reemplazar, permisos y aislamiento", async ({ page, browser }) => {
  const { default: sharp } = await import("sharp");
  const { batches } = await (await page.request.get("/api/batches")).json();
  const [primero, segundo] = batches;
  const base = `/api/batches/${primero.id}/fotos`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/stock/${primero.id}`);
  const selector = page.getByLabel("Sección del lote");
  await selector.selectOption("fotos");
  const input = page.getByLabel("Agregar foto del lote");
  await expect(input).toBeEnabled();
  await input.setInputFiles({ name: "vacia.png", mimeType: "image/png", buffer: Buffer.alloc(0) });
  await expect(page.getByText("La foto está vacía.")).toBeVisible();
  const bytes = await sharp({ create: { width: 12, height: 18, channels: 3, background: "#388055" } }).png().toBuffer();
  const archivo = { name: "lote.png", mimeType: "image/png", buffer: bytes };
  await input.setInputFiles(archivo);
  const imagen = page.getByRole("img", { name: `Foto 1 del lote ${primero.code}` });
  await expect(imagen).toBeVisible();
  const inicial = (await imagen.getAttribute("src"))!;
  expect((await page.request.get(inicial)).headers()["content-type"]).toBe("image/webp");
  await page.getByLabel("Reemplazar foto 1").setInputFiles(archivo);
  await expect(imagen).not.toHaveAttribute("src", inicial);
  await input.setInputFiles(archivo);
  await expect(page.getByRole("img", { name: `Foto 2 del lote ${primero.code}` })).toBeVisible();
  await page.reload();
  await expect(imagen).toBeVisible();
  const otro = inicial.replace(primero.id, segundo.id);
  expect((await page.request.get(otro)).status()).toBe(404);
  expect((await page.request.post(otro, { data: bytes, headers: { "content-type": "image/png" } })).status()).toBe(404);
  await selector.selectOption("destinatarios");
  await expect(page.getByRole("heading", { name: "A quién se entregó" })).toBeVisible();
  const op = await browser.newContext({ storageState: "e2e/.state/operador.json" });
  try {
    expect((await op.request.post(base, { data: bytes, headers: { "content-type": "image/png" } })).status()).toBe(403);
    expect((await op.request.get(inicial)).ok()).toBeTruthy();
  } finally { await op.close(); }
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try { expect((await anon.request.get(inicial)).status()).toBe(401); } finally { await anon.close(); }
});
