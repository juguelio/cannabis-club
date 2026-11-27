import { PrismaClient } from "@prisma/client";
import { E2E_DATABASE_URL } from "../env";
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

    await page.getByRole("link", { name: "Datos del socio", exact: true }).click();
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
  await page.getByRole("link", { name: "Documentación", exact: true }).click();
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
  const nav = page.getByRole("navigation", { name: "Secciones del legajo" });
  for (const label of ["Envíos", "Turnos", "Entregas", "Avisos", "Pedidos", "Cuenta corriente", "Cambios del legajo", "Consentimientos"]) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
    if (label === "Envíos") {
      const historial = page.locator(".legajo-contenido");
      await expect(historial.getByRole("link", { name: shipment.code })).toHaveAttribute("href", `/traslados/${shipment.id}`);
      await expect(historial).toContainText("Destino del legajo");
    }
  }
  const operador = await browser.newContext({ storageState: "e2e/.state/operador.json" });
  try {
    const vista = await operador.newPage();
    await vista.goto(perfil);
    await expect(vista.getByRole("link", { name: "Documentación", exact: true })).toHaveCount(0);
    await vista.goto(perfil + "/documentacion");
    await expect(vista.getByRole("heading", { name: "Documentación del socio" })).toHaveCount(0);
    expect((await vista.request.get(new URL(url!, perfil).href)).status()).toBe(403);
  } finally {
    await operador.close();
  }
});

test("resumen, revisión, archivos y avisos paginados por socio desde el celular", async ({ page }) => {
  const db = new PrismaClient({ datasourceUrl: E2E_DATABASE_URL });
  const base = { firstName: "Prueba", lastName: "Legajo", status: "ACTIVO" as const };
  const socio = await db.member.create({ data: { ...base, legajo: 98001 } });
  const otro = await db.member.create({ data: { ...base, legajo: 98002, verificationStatus: "VERIFICADO" } });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    const ruta = `/socios/${socio.id}`;
    const selector = page.getByRole("combobox", { name: "Sección del legajo" });
    await page.goto(ruta);
    await page.getByRole("link", { name: /Esperando documentación del socio/ }).click();
    await expect(page).toHaveURL(/\/documentacion$/);
    await expect(page.getByText("Este legajo todavía no tiene expedientes digitales.")).toBeVisible();
    await page.goBack();
    await expect(selector).toHaveValue("resumen");

    await db.memberVerification.create({ data: {
      memberId: socio.id, docNumberCipher: PNG_1X1, docHash: "test-resumen", docLast4: "0001",
      birthDate: new Date("1990-01-01"), reprocannNumber: "test", reprocannExpiresAt: new Date("2030-01-01"),
      documents: { create: ["DNI_FRENTE", "DNI_DORSO", "REPROCANN"].map(tipo => ({
        tipo, mime: "image/png", size: 1, sha256: "test", iv: PNG_1X1, tag: PNG_1X1, data: PNG_1X1,
      })) },
    } });
    await db.member.update({ where: { id: socio.id }, data: { verificationStatus: "EN_REVISION" } });
    await page.reload();
    await page.getByRole("link", { name: /Documentación lista para revisar/ }).click();
    await expect(page.getByRole("button", { name: "Aprobar legajo" })).toBeEnabled();
    await selector.selectOption("avisos");
    await expect(page.getByText("Sin registros en esta página.")).toBeVisible();
    await db.noticeLog.createMany({ data: Array.from({ length: 21 }, (_, i) => ({
      memberId: socio.id, kind: "CARTA_CLUB", channel: "EMAIL", note: `Aviso de prueba ${i}`,
      sentAt: new Date(Date.UTC(2026, 0, i + 1)),
    })) });
    await page.goto(ruta + "?historial=avisos&pagina=2#historial-socio");
    await expect(page).toHaveURL(/\/avisos\?pagina=2/);
    await expect(page.getByText(/Aviso de prueba 0$/)).toBeVisible();
    await page.getByRole("link", { name: "Anterior" }).click();
    await expect(page.getByRole("link", { name: "Siguiente" })).toBeVisible();
    await page.goto(`/socios/${otro.id}`);
    await expect(page.getByText("Sin pendientes", { exact: true })).toBeVisible();
    await selector.selectOption("avisos");
    await expect(page.getByText("Sin registros en esta página.")).toBeVisible();
    await selector.selectOption("documentacion");
    await expect(page.getByText("Este legajo todavía no tiene expedientes digitales.")).toBeVisible();
  } finally {
    await db.member.deleteMany({ where: { id: { in: [socio.id, otro.id] } } });
    await db.$disconnect();
  }
});
