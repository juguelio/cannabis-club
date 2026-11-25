import { expect, test } from "../fixtures";

const formularios = [
  { ruta: "/socios/nuevo", guardar: "Crear legajo", campos: ["lastName", "firstName", "docNumber", "birthDate"] },
  { ruta: "/stock", abrir: "Nuevo lote", guardar: "Crear lote", campos: ["code"] },
  { ruta: "/stock", abrir: "Ajuste o destrucción", guardar: "Registrar movimiento", campos: ["grams", "reason"] },
  { ruta: "/traslados", abrir: "Nuevo traslado", guardar: "Abrir traslado", campos: ["toAddress", "carrierName"] },
  { ruta: "/configuracion?seccion=catalogo", guardar: "Crear variedad", campos: ["name"] },
  { ruta: "/configuracion?seccion=equipo", abrir: "Sumar a alguien", guardar: "Crear cuenta", campos: ["name", "email", "password"] },
  { ruta: "/calendario", detalle: "Franjas de atención y cupos", guardar: "Cerrar día", campos: ["date"] },
  { ruta: "/cartas", guardar: "Guardar borrador", campos: ["edicion", "titulo", "copete", "apertura"] },
];

for (const caso of formularios) {
  test(`${caso.guardar} identifica los campos obligatorios`, async ({ page }) => {
    await page.goto(caso.ruta);
    if (caso.abrir) await page.getByRole("button", { name: caso.abrir, exact: true }).click();
    if (caso.detalle) await page.getByText(caso.detalle, { exact: true }).click();
    const boton = page.getByRole("button", { name: caso.guardar, exact: true });
    const form = page.locator("form").filter({ has: boton });
    await boton.click();
    await expect(form.getByRole("alert")).toContainText(/antes de continuar/);
    for (const campo of caso.campos) {
      const control = form.locator(`[name="${campo}"]`);
      await expect(control).toHaveAttribute("aria-invalid", "true");
      await expect(control).toHaveAccessibleDescription(/Completá/);
    }
  });
}

test("alta de socio muestra juntos los errores del servidor y conserva los datos válidos", async ({ page }) => {
  await page.goto("/socios/nuevo");
  await page.getByLabel("Apellido").fill("A");
  await page.getByLabel("Nombre", { exact: true }).fill("B");
  await page.getByLabel("DNI", { exact: true }).fill("12");
  await page.getByLabel("Nacimiento").fill("1990-02-03");
  await page.getByRole("button", { name: "Crear legajo" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "3 campos" })).toContainText("3 campos");
  await expect(page.getByLabel("Apellido")).toHaveAccessibleDescription("Ingresá el apellido");
  await expect(page.getByLabel("DNI", { exact: true })).toHaveAccessibleDescription("Documento inválido");
  await page.getByLabel("Apellido").fill("García");
  await expect(page.getByRole("alert").filter({ hasText: "2 campos" })).toContainText("2 campos");
  await expect(page.getByLabel("Nacimiento")).toHaveValue("1990-02-03");
});

test("el padrón marca el DNI ya registrado en el campo correspondiente", async ({ page }) => {
  await page.goto("/socios/nuevo");
  for (const [nombre, valor] of Object.entries({ firstName: "Ana", lastName: "García", docNumber: "30111222", birthDate: "1990-02-03" })) {
    await page.locator(`[name="${nombre}"]`).fill(valor);
  }
  await page.getByRole("button", { name: "Crear legajo" }).click();
  await expect(page.getByLabel("DNI", { exact: true })).toHaveAccessibleDescription(/ya está en el padrón/);
  await expect(page.getByLabel("DNI", { exact: true })).toBeFocused();
});

test("un error en marca conserva el email escrito y señala cómo corregirlo", async ({ page }) => {
  await page.goto("/configuracion?seccion=marca");
  const email = page.locator('[name="contacto.email"]');
  await email.fill("contacto");
  await page.getByRole("button", { name: "Guardar marca" }).click();
  await expect(email).toHaveAccessibleDescription(/nombre@dominio.com/);
  await expect(email).toHaveValue("contacto");
});

test("cambiar la clave identifica la confirmación que difiere", async ({ page }) => {
  await page.goto("/cuenta/clave");
  await page.locator('[name="current"]').fill("Admin1234!");
  await page.locator('[name="next"]').fill("DosClaves1234");
  const repeat = page.locator('[name="repeat"]');
  await repeat.fill("OtraClave1234");
  await page.getByRole("button", { name: "Guardar clave" }).click();
  await expect(repeat).toHaveAccessibleDescription(/no coinciden/);
});

test("el club puede corregir un CBU inválido sin perder el alias", async ({ page }) => {
  await page.goto("/configuracion?seccion=precios");
  const cbu = page.locator('[name="cobro.cbu"]');
  const alias = page.locator('[name="cobro.alias"]');
  await alias.fill("club.demo");
  await cbu.fill("123");
  await page.getByRole("button", { name: "Guardar datos de cobro" }).click();
  await expect(cbu).toHaveAccessibleDescription(/22 números/);
  await expect(alias).toHaveValue("club.demo");
});

test("importar el padrón identifica las filas erróneas antes de permitir la confirmación", async ({ page }) => {
  await page.goto("/configuracion?seccion=importar", { waitUntil: "networkidle" });
  const archivo = page.getByLabel("Elegir archivo CSV");
  const vistaPrevia = page.waitForResponse(r => r.url().endsWith("/api/members/import") && r.request().method() === "POST");
  await archivo.setInputFiles({
    name: "padron.csv", mimeType: "text/csv",
    buffer: Buffer.from("Apellido,Nombre,DNI,Nacimiento\nEjemplo,Ana,,1990-01-01"),
  });
  expect((await vistaPrevia).status()).toBe(200);
  const subir = page.locator('input[type=file]');
  await expect(subir).toHaveAccessibleDescription(/Fila 2/);
  await expect(page.getByRole("button", { name: "Importar 0 socios" })).toBeDisabled();
});

test("el libro de dispensaciones explica un rango invertido y permite descargar tras corregirlo", async ({ page }) => {
  await page.goto("/reportes");
  const form = page.locator('form[action="/api/reports/dispensaciones"]');
  await form.getByLabel("Desde").fill("2026-10-01");
  const hasta = form.getByLabel("Hasta");
  await hasta.fill("2026-09-01");
  await form.getByRole("button").click();
  await expect(hasta).toHaveAccessibleDescription(/2026-10-01/);
  await hasta.fill("2026-10-31");
  const [archivo] = await Promise.all([page.waitForEvent("download"), form.getByRole("button").click()]);
  expect(archivo.suggestedFilename()).toMatch(/\.csv$/);
});

test("una cuenta nueva de dispensario cambia la clave temporal y entra al mostrador", async ({ page, browser }) => {
  const email = "mostrador-e2e@club.test";
  await page.goto("/configuracion?seccion=equipo");
  await page.getByRole("button", { name: "Sumar a alguien" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre", { exact: true }).fill("Mostrador de prueba");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Rol").selectOption("DISPENSADOR");
  await dialog.getByLabel("Clave inicial").fill("TemporalClub123!");
  await dialog.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(email, { exact: true })).toBeVisible();

  const nuevo = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const caja = await nuevo.newPage();
    await caja.goto("/login");
    await caja.getByLabel("Email").fill(email);
    await caja.getByLabel("Contraseña", { exact: true }).fill("TemporalClub123!");
    await caja.getByRole("button", { name: "Ingresar", exact: true }).click();
    await expect(caja).toHaveURL(/\/cuenta\/clave$/);
    await caja.locator('[name="current"]').fill("TemporalClub123!");
    await caja.locator('[name="next"]').fill("MiClaveNueva234!");
    await caja.locator('[name="repeat"]').fill("MiClaveNueva234!");
    await caja.getByRole("button", { name: "Guardar clave" }).click();
    await expect(caja).toHaveURL(/\/$/);
    await caja.goto("/dispensario");
    await expect(caja.getByRole("heading", { level: 1 })).toContainText("Dispensario");
    await caja.goto("/configuracion");
    await expect(caja).toHaveURL(/\/$/);
  } finally {
    await nuevo.close();
  }
});
