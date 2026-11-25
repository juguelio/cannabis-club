import { expect, test } from "../fixtures";
import { crearPedido, PNG_1X1 } from "../helpers";

/**
 * El comprobante es la prueba de que el socio transfirió: sin él el pedido no se cierra y el club no
 * prepara nada. Se prueba el rechazo de lo que no es una imagen, la subida real y el cierre del pedido.
 */
test.describe("comprobante", () => {
  test("sin archivo no deja subir", async ({ page }) => {
    const pedido = await crearPedido(page);
    await page.goto(`/portal/pedido/pago/${pedido}`, { waitUntil: "networkidle" });

    const subir = page.getByRole("button", { name: /Primero subí el comprobante|Subir comprobante/ });
    await expect(subir).toBeDisabled();
  });

  test("el selector explica por qué rechaza un archivo de texto", async ({ page }) => {
    const pedido = await crearPedido(page);
    await page.goto(`/portal/pedido/pago/${pedido}`, { waitUntil: "networkidle" });

    const input = page.locator("input[type=file]").last();
    await input.setInputFiles({ name: "vacio.txt", mimeType: "text/plain", buffer: Buffer.from("no soy un comprobante") });

    await expect(input).toHaveAccessibleDescription(/foto|imagen|JPG|PNG|PDF/i);
    await expect(page.getByText("No se pudo presentar el comprobante. Revisá el dato señalado.")).toBeVisible();
  });

  test("subir la foto cierra el pedido y avisa que queda en revisión", async ({ page }) => {
    const pedido = await crearPedido(page);
    await page.goto(`/portal/pedido/pago/${pedido}`, { waitUntil: "networkidle" });

    // La galería es el input de archivos que usa el celular.
    await page.locator("input[type=file]").last().setInputFiles({ name: "comprobante.png", mimeType: "image/png", buffer: PNG_1X1 });

    const subir = page.getByRole("button", { name: /Subir comprobante/ });
    await expect(subir).toBeEnabled();
    await subir.click();

    await expect(page).toHaveURL(/\/portal\/pedido\/listo\//, { timeout: 20_000 });
    await expect(page.locator("body")).toContainText(/revisi[óo]n|Recibimos tu comprobante/i);
    await expect(page.locator("body")).not.toContainText("Aprobado por el club");
  });
});
