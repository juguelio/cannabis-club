import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { BASE_URL, E2E_DATABASE_URL } from "../env";
import { expect, test } from "../fixtures";
import { PNG_1X1 } from "../helpers";

test("alta pública: corrige varios datos, presenta la solicitud y reemplaza un archivo inválido", async ({ page }) => {
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
  const datos = { firstName: "Ana", lastName: "Prueba", birthDate: "1990-01-01", docNumber: "12",
    phone: "11", address: "Calle 123", reprocannNumber: "12345678", reprocannExpiresAt: "2099-12-31" };
  for (const [nombre, valor] of Object.entries(datos)) await form.locator(`[name="${nombre}"]`).fill(valor);
  await form.getByRole("checkbox").check();
  const continuar = page.getByRole("button", { name: "Continuar a la documentación" });
  await continuar.click();
  await expect(form.getByRole("alert")).toContainText("2 campos");
  await expect(form.locator('[name="phone"]')).toHaveAccessibleDescription(/código de área/);
  await expect(form.locator('[name="docNumber"]')).toHaveAccessibleDescription(/7 u 8/);
  await form.locator('[name="docNumber"]').fill("45444333");
  await form.locator('[name="phone"]').fill("2944123456");
  await form.locator('[name="birthDate"]').fill(new Date().toISOString().slice(0, 10));
  await continuar.click();
  await expect(form.getByRole("alert")).toContainText(/Fecha de nacimiento.*todavía no cumpliste 18 años/);
  await expect(form.locator('[name="birthDate"]')).toHaveAccessibleDescription(/edad mínima para asociarte/);
  await form.locator('[name="birthDate"]').fill("1990-01-01");
  await page.route("**/api/solicitud", route => route.request().method() === "POST"
    ? route.fulfill({ status: 500, json: { error: "INTERNAL", message: "Error interno" } })
    : route.continue());
  await continuar.click();
  await expect(form.getByRole("alert")).toContainText("La solicitud no quedó presentada");
  await expect(form.locator('[name="firstName"]')).toHaveValue("Ana");
  await page.unroute("**/api/solicitud");
  await continuar.click();
  await expect(page.getByRole("heading", { name: "Solicitud recibida" })).toBeVisible();
  const frente = page.getByLabel("Subir DNI (frente)", { exact: true });
  await frente.setInputFiles({ name: "archivo.txt", mimeType: "text/plain", buffer: Buffer.from("prueba") });
  await expect(frente).toHaveAccessibleDescription(/JPG, PNG, WEBP o PDF/);
  await expect(page.getByRole("alert").filter({ hasText: "DNI (frente)" })).toContainText("DNI (frente)");
  await frente.setInputFiles({ name: "dni.png", mimeType: "image/png", buffer: PNG_1X1 });
  await expect(page.getByLabel("Reemplazar DNI (frente)", { exact: true })).toBeAttached();
  await page.reload();
  await expect(page.getByLabel("Reemplazar DNI (frente)", { exact: true })).toBeAttached();
});
