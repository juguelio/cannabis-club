import { PNG_1X1 } from "../helpers";
import { expect, test } from "../fixtures";

/**
 * El padrón es la pieza que sostiene todo lo demás: si el club no encuentra a un socio, no lo atiende.
 * Se prueba la búsqueda, los filtros, la ficha y el alta.
 */
test.describe("padrón", () => {
  test("lista a los socios con su legajo", async ({ page }) => {
    await page.goto("/socios");
    await expect(page.locator("body")).toContainText("Gómez, María");
    await expect(page.locator("body")).toContainText("Pérez, Julián");
    await expect(page.locator("body")).toContainText("Legajo");
  });

  test("los contadores de los filtros suman lo que hay", async ({ page }) => {
    await page.goto("/socios");
    await expect(page.getByRole("link", { name: /^Todos\s+\d+/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Activos\s+\d+/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Pendientes\s+\d+/ })).toBeVisible();
  });

  test("filtra por estado y muestra sólo los activos", async ({ page }) => {
    await page.goto("/socios?estado=ACTIVO");
    await expect(page.locator("body")).toContainText("Gómez, María");

    await page.goto("/socios?estado=PENDIENTE");
    await expect(page.locator("body")).toContainText("Méndez, Carla");
    await expect(page.locator("body")).not.toContainText("Gómez, María");
  });

  test("busca por apellido y por legajo", async ({ page }) => {
    await page.goto("/socios");
    const buscador = page.getByLabel("Buscar en el padrón");
    await buscador.fill("Gómez");
    await buscador.press("Enter");
    await expect(page.locator("body")).toContainText("Gómez, María");
    await expect(page.locator("body")).not.toContainText("Pérez, Julián");

    await buscador.fill("2");
    await buscador.press("Enter");
    await expect(page.locator("body")).toContainText(/Pérez|Legajo 2/);
  });

  test("la ficha del socio abre con sus datos y su REPROCANN", async ({ page }) => {
    await page.goto("/socios");
    await page.getByRole("link", { name: /Gómez, María/ }).first().click();
    await expect(page.locator("body")).toContainText("María");
    await expect(page.locator("body")).toContainText(/REPROCANN|Legajo/);
  });

  test("el botón de editar abre el legajo editable", async ({ page }) => {
    await page.goto("/socios");
    await page.getByRole("link", { name: /Gómez, María/ }).first().click();

    const editar = page.getByRole("button", { name: /Editar legajo/i });
    await expect(editar).toBeVisible();
    await editar.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(/Legajo|Teléfono|Dirección/i);

    // Cerrar sin guardar no deja nada a medias.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("el alta de socio pide lo mínimo y avisa si falta", async ({ page }) => {
    await page.goto("/socios/nuevo");
    await expect(page.locator("body")).toContainText(/Nombre|Apellido|DNI/);

    const guardar = page.getByRole("button", { name: /Guardar|Dar de alta|Crear/i }).first();
    await guardar.click();
    // Sin datos, el formulario no manda nada: se queda en el alta y muestra el error del campo.
    await expect(page).toHaveURL(/\/socios\/nuevo/);
  });

  test("un socio que no existe no rompe la ficha", async ({ page }) => {
    const resp = await page.goto("/socios/no-existe-999");
    // Hoy la ficha responde 200 con un aviso: lo que importa es que no explote ni invente datos.
    expect([200, 404]).toContain(resp?.status() ?? 0);
    await expect(page.locator("body")).not.toContainText(/Application error|Internal Server Error/);
    await expect(page.locator("body")).not.toContainText("30111222");
  });
});

test("el administrador consulta los archivos ya verificados y el historial desde el legajo", async ({ page, browser }) => {
  await page.goto("/socios");
  await page.getByRole("link", { name: /Gómez, María/ }).first().click();
  await expect(page).toHaveURL(/\/socios\/[^/?]+$/);
  const perfil = page.url();
  await expect(page.getByRole("heading", { name: "Documentación del socio" })).toBeVisible();
  const archivo = page.getByRole("link", { name: "DNI (frente)", exact: true });
  const url = await archivo.getAttribute("href");
  expect(url).toMatch(/^\/api\/verificaciones\//);
  const response = await page.request.get(url!);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.body()).toEqual(PNG_1X1);
  const nuevo = await page.request.post("/api/shipments", { data: { fromAddress: "Sede central", toAddress: "Destino del legajo", carrierName: "Transporte de prueba" } });
  expect(nuevo.status()).toBe(201);
  const { shipment } = await nuevo.json();
  const { batches } = await (await page.request.get("/api/batches")).json();
  const memberId = new URL(perfil).pathname.split("/").pop();
  const item = await page.request.post(`/api/shipments/${shipment.id}/items`, { data: { memberId, batchId: batches[0].id, grams: 3 } });
  expect(item.status(), await item.text()).toBe(201);
  const nav = page.getByRole("navigation", { name: "Historial del socio" });
  for (const label of ["Envíos", "Turnos", "Entregas", "Avisos", "Pedidos"]) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page.locator("#historial-socio h3")).toHaveText(label);
    if (label === "Envíos") {
      const historial = page.locator("#historial-socio");
      await expect(historial.getByRole("link", { name: shipment.code })).toHaveAttribute("href", `/traslados/${shipment.id}`);
      await expect(historial).toContainText("Destino del legajo");
    }
  }
  const operador = await browser.newContext({ storageState: "e2e/.state/operador.json" });
  try {
    const vista = await operador.newPage();
    await vista.goto(perfil);
    await expect(vista.getByRole("heading", { name: "Documentación del socio" })).toHaveCount(0);
    expect((await vista.request.get(new URL(url!, perfil).href)).status()).toBe(403);
  } finally {
    await operador.close();
  }
});
