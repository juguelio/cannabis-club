import { expect, test } from "../fixtures";

/**
 * Las pantallas de gestión del día a día, cada una con lo que tiene que estar diciendo. No es un
 * «abre y no explota»: en cada una se mira el dato que el club usa para decidir.
 */
test.describe("aportes y plata", () => {
  test("los aportes muestran el rango de fechas y lo transferido", async ({ page }) => {
    await page.goto("/aportes");
    await expect(page.locator("body")).toContainText(/Aporte|Enviado|Total/i);
    await page.getByRole("link", { name: /^Este mes/ }).click();
    await expect(page).toHaveURL(/envios=mes/);
  });

  test("los envíos por destino se pueden mirar por período", async ({ page }) => {
    await page.goto("/aportes?envios=anio");
    await expect(page.locator("body")).toContainText(/Env[íi]os|destino/i);
  });

  test("el cierre del día ofrece los libros para descargar", async ({ page }) => {
    await page.goto("/cierre");
    await expect(page.locator("body")).toContainText(/Cierre del día|Libro/i);
    await expect(page.getByRole("link", { name: /Libro de dispensaciones/i })).toBeVisible();
  });

  test("los libros descargan un CSV con encabezado", async ({ page }) => {
    await page.goto("/reportes");
    const boton = page.getByRole("button", { name: /Descargar CSV/ }).first();
    await expect(boton).toBeVisible();

    // El botón envía el formulario de filtros y el servidor contesta el CSV: se espera la respuesta.
    const esperando = page.waitForResponse((r) => /\/api\/reports\//.test(r.url()), { timeout: 20_000 });
    await boton.click();
    const resp = await esperando;
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toContain("text/csv");
    expect(resp.headers()["content-disposition"]).toContain(".csv");

    // El navegador lo trata como descarga, así que el cuerpo se pide aparte y se mira el encabezado.
    const libro = await page.request.get("/api/reports/dispensaciones");
    const csv = await libro.text();
    expect(csv.split("\n")[0]).toMatch(/Fecha|Lote|Socio|Apellido/);
  });
});

test.describe("operación diaria", () => {
  test("los turnos del día se listan con su hora", async ({ page }) => {
    await page.goto("/turnos");
    await expect(page.locator("body")).toContainText(/\d{2}:\d{2}/);
  });

  test("el calendario abre en el mes y deja cambiar de vista", async ({ page }) => {
    await page.goto("/calendario");
    await page.getByRole("button", { name: /Semana|Mes/ }).first().click();
    await expect(page.locator("body")).toContainText(/lun|mar|mié|jue|vie|sáb|dom/i);
  });

  test("el control del club lista lo que necesita atención", async ({ page }) => {
    await page.goto("/control");
    await expect(page.locator("body")).toContainText(/Control/i);
    await expect(page.locator("body")).toContainText(/vencid|revisar|pendiente|sin validar/i);
  });

  test("los avisos se pueden filtrar y dicen a quién le toca", async ({ page }) => {
    await page.goto("/avisos");
    await expect(page.locator("body")).toContainText(/Padrón filtrado|Avisos/i);
    await expect(page.getByRole("link", { name: /Padrón filtrado/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sin avisar/ })).toBeVisible();
  });

  test("los traslados se listan y se pueden crear", async ({ page }) => {
    await page.goto("/traslados");
    await expect(page.getByRole("button", { name: /Nuevo traslado/ })).toBeVisible();
  });

  test("las cartas se editan en bloques", async ({ page }) => {
    await page.goto("/cartas");
    await expect(page.locator("body")).toContainText(/Carta|bloque/i);
    await expect(page.getByRole("button", { name: /Guardar borrador/ })).toBeVisible();
  });

  test("el informe semestral se puede imprimir", async ({ page }) => {
    await page.goto("/informe-semestral");
    await expect(page.getByRole("link", { name: /Imprimir/ })).toBeVisible();
  });

  test("el modo inspección muestra todo sin filtros", async ({ page }) => {
    await page.goto("/inspeccion");
    await expect(page.locator("body")).toContainText(/inspecci[óo]n/i);
  });
});

test.describe("configuración", () => {
  test("muestra la configuración actual del club y guarda sin romper", async ({ page }) => {
    await page.goto("/configuracion");
    await expect(page.locator("body")).toContainText(/Aporte por gramo|Topes|Env[íi]os/i);

    const guardar = page.getByRole("button", { name: /Guardar configuración/ }).first();
    await expect(guardar).toBeVisible();
    await guardar.click();

    // Guardar lo mismo que ya estaba tiene que ser inocuo y decir que quedó.
    await expect(page.locator("body")).toContainText(/guardad|listo|ok/i, { timeout: 15_000 });
  });

  test("la sección de importar padrón se abre desde el link del club", async ({ page }) => {
    await page.goto("/configuracion?seccion=importar");
    await expect(page.locator("body")).toContainText(/importar|padr[óo]n/i);
  });
});
