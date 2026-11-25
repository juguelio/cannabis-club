import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { BASE_URL, E2E_DATABASE_URL } from "../env";
import { expect, test } from "../fixtures";
import { PNG_1X1 } from "../helpers";

test("alta pública: corrige varios datos, presenta la solicitud y reemplaza un archivo inválido", async ({ page, browser }) => {
  // El fixture representa la vuelta de Google. Todo el trámite posterior usa la UI y la API reales.
  const db = new PrismaClient({ datasourceUrl: E2E_DATABASE_URL });
  let id: string;
  try {
    const user = await db.user.create({
      data: { email: "solicitud-e2e@club.test", name: "Socio de prueba", role: "SOCIO", active: false },
    });
    id = user.id;
  } finally {
    await db.$disconnect();
  }
  const token = await new SignJWT({ scope: "solicitud" }).setSubject(id).setIssuedAt()
    .setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m")
    .sign(new TextEncoder().encode(process.env.E2E_AUTH_SECRET));
  await page.context().addCookies([{ name: "cc_solicitud", value: token, url: BASE_URL, httpOnly: true }]);
  await page.goto("/solicitud");
  await page.getByRole("button", { name: /Sí, ya lo tengo/ }).click();
  const form = page.locator("form");
  const fechas = [
    { campo: "birthDate", etiqueta: "Fecha de nacimiento", limite: "max", desplazamiento: 1, motivo: /edad mínima/ },
    { campo: "reprocannExpiresAt", etiqueta: "Vence", limite: "min", desplazamiento: -1, motivo: /vencido/ },
  ];
  const formato = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "UTC" });
  for (const { campo, etiqueta, limite, desplazamiento, motivo } of fechas) {
    const input = form.locator(`[name="${campo}"]`);
    const corte = await input.getAttribute(limite);
    expect(corte).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const permitida = new Date(corte + "T00:00:00Z");
    const bloqueada = new Date(permitida);
    bloqueada.setUTCDate(permitida.getUTCDate() + desplazamiento);
    const abrir = form.getByRole("button", { name: `Calendario: ${etiqueta}` });
    await abrir.click();
    const panel = form.getByRole("region", { name: `Elegir fecha: ${etiqueta}` });
    const mes = panel.getByLabel("Mes visible");
    await mes.fill(bloqueada.toISOString().slice(0, 7));
    const dia = panel.getByRole("button", { name: formato.format(bloqueada), exact: true });
    await expect(dia).toBeDisabled();
    await dia.hover();
    await expect(panel.getByRole("tooltip")).toHaveText(motivo);
    await dia.click({ force: true });
    await expect(input).toHaveValue("");
    await dia.focus();
    await dia.press("Enter");
    await expect(dia).toHaveAccessibleDescription(motivo);
    await dia.press("Escape");
    await expect(abrir).toBeFocused();
    await abrir.click();
    await panel.getByRole("button", { name: formato.format(permitida), exact: true }).click();
    await expect(input).toHaveValue(corte!);
    await expect(panel).toHaveCount(0);
  }
  const movil = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  try {
    await movil.addCookies(await page.context().cookies());
    const pantalla = await movil.newPage();
    await pantalla.goto(BASE_URL + "/solicitud");
    await pantalla.getByRole("button", { name: /Sí, ya lo tengo/ }).tap();
    await pantalla.getByRole("button", { name: "Calendario: Vence" }).tap();
    const calendario = pantalla.getByRole("region", { name: "Elegir fecha: Vence" });
    await calendario.getByRole("button", { name: "Mes anterior" }).tap();
    await calendario.locator('button[aria-disabled="true"]').first().tap({ force: true });
    await expect(calendario.getByRole("tooltip")).toHaveText(/vencido/);
    await expect(pantalla.getByLabel("Vence", { exact: true })).toHaveValue("");
  } finally {
    await movil.close();
  }
  const datos = { firstName: "Ana", lastName: "Prueba", birthDate: "1990-01-01", docNumber: "12",
    phone: "11", address: "Calle 123", reprocannNumber: "12345678", reprocannExpiresAt: "2099-12-31" };
  for (const [nombre, valor] of Object.entries(datos)) await form.locator(`[name="${nombre}"]`).fill(valor);
  await form.getByRole("checkbox").check();
  const continuar = page.getByRole("button", { name: "Presentar solicitud y subir documentos" });
  await continuar.click();
  await expect(form.locator('[aria-invalid="true"]')).toHaveCount(2);
  await expect(form.locator('[name="phone"]')).toHaveAccessibleDescription(/código de área/);
  await expect(form.locator('[name="docNumber"]')).toHaveAccessibleDescription(/7 u 8/);
  await expect(form.locator('[name="docNumber"]')).toBeFocused();
  let envios = 0;
  page.on("request", req => { if (req.url().endsWith("/api/solicitud") && req.method() === "POST") envios++; });
  const invalidos = { ...datos, docNumber: "45A444333", phone: "29X44123456", birthDate: "", reprocannExpiresAt: "", affidavitAccepted: false };
  for (const campo of ["docNumber", "phone", "birthDate", "reprocannExpiresAt"] as const) {
    await form.locator(`[name="${campo}"]`).fill(invalidos[campo]);
  }
  await form.getByRole("checkbox").uncheck();
  await continuar.click();
  const mensajes = {
    docNumber: "Ingresá los 7 u 8 dígitos del DNI sin letras.",
    phone: "Ingresá el teléfono sin letras. Podés usar espacios, guiones, paréntesis y el signo +.",
    birthDate: "Ingresá tu fecha de nacimiento.",
    reprocannExpiresAt: "Ingresá la fecha de vencimiento de tu REPROCANN.",
    affidavitAccepted: "Para presentar la solicitud, confirmá la declaración.",
  };
  const respuesta = await page.request.post("/api/solicitud", { data: invalidos });
  expect(respuesta.status()).toBe(400);
  const { details } = await respuesta.json();
  for (const [campo, mensaje] of Object.entries(mensajes)) {
    await expect(form.locator(`[name="${campo}"]`)).toHaveAccessibleDescription(mensaje);
    expect(details).toContainEqual({ campo, mensaje });
  }
  expect(envios).toBe(0);
  await form.getByRole("checkbox").check();
  await form.locator('[name="reprocannExpiresAt"]').fill("2000-01-01");
  await continuar.click();
  await expect(form.locator('[name="reprocannExpiresAt"]')).toHaveAccessibleDescription(/vencido/);
  await form.locator('[name="reprocannExpiresAt"]').fill(datos.reprocannExpiresAt);
  await form.locator('[name="docNumber"]').fill("45444333");
  await form.locator('[name="phone"]').fill("2944 12-3456");
  await form.locator('[name="birthDate"]').fill(new Date().toISOString().slice(0, 10));
  await continuar.click();
  await expect(form.locator('[name="birthDate"] + .field-error')).toHaveText(/todavía no cumpliste 18 años/);
  await expect(form.getByText(/todavía no cumpliste 18 años/)).toHaveCount(1);
  await expect(form.locator('[name="birthDate"]')).toHaveAccessibleDescription(/edad mínima para asociarte/);
  await form.locator('[name="birthDate"]').fill("1990-01-01");
  await page.route("**/api/solicitud", route => route.request().method() === "POST"
    ? route.fulfill({ status: 500, json: { error: "INTERNAL", message: "Error interno" } })
    : route.continue());
  await continuar.click();
  await expect(form.getByRole("alert")).toContainText("La solicitud no quedó presentada");
  await expect(form.locator('[name="firstName"]')).toHaveValue("Ana");
  await expect(form.locator('[name="birthDate"]')).toHaveValue(datos.birthDate);
  await expect(form.locator('[name="reprocannExpiresAt"]')).toHaveValue(datos.reprocannExpiresAt);
  await page.unroute("**/api/solicitud");
  await continuar.click();
  await expect(page.getByRole("heading", { name: "Solicitud recibida" })).toBeVisible();
  const frente = page.getByLabel("Subir DNI (frente)", { exact: true });
  await frente.setInputFiles({ name: "archivo.txt", mimeType: "text/plain", buffer: Buffer.from("prueba") });
  await expect(frente).toHaveAccessibleDescription(/JPG, PNG, WEBP o PDF/);
  await expect(page.locator("#archivo-error-DNI_FRENTE")).toBeVisible();
  await frente.setInputFiles({ name: "dni.png", mimeType: "image/png", buffer: PNG_1X1 });
  await expect(page.getByLabel("Reemplazar DNI (frente)", { exact: true })).toBeAttached();
  await page.reload();
  await expect(page.getByLabel("Reemplazar DNI (frente)", { exact: true })).toBeAttached();
});
