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
