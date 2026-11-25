import { Prisma, PrismaClient } from "@prisma/client";
import { expect, test } from "../fixtures";
import { E2E_DATABASE_URL } from "../env";
import { CLUB_ID } from "../../src/lib/club";

test("la portada usa la letra gótica y Quiénes somos muestra el logo en escritorio y móvil", async ({ page }) => {
  const db = new PrismaClient({ datasourceUrl: E2E_DATABASE_URL });
  const where = { id: CLUB_ID };
  const { marca } = await db.club.findUniqueOrThrow({ where, select: { marca: true } });
  try {
    await db.club.update({ where, data: { marca: {
      lema: "Un club de la salud", presentacion: "Somos República, una asociación civil de San Telmo.",
      sitio: { publico: true },
    } } });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/sitio");
      const titular = page.locator(".s-hero h1 span");
      await expect(titular).toHaveText("Un club de la salud");
      await expect(titular).toHaveCSS("font-family", /UnifrakturMaguntia/);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.fonts.check('24px UnifrakturMaguntia'))).toBe(true);
      const seccion = page.locator("#quienes-somos");
      const logo = seccion.getByRole("heading", { name: /Quiénes somos/ }).getByRole("img");
      await logo.scrollIntoViewIfNeeded();
      await expect(logo).toBeVisible();
      await expect.poll(() => logo.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await expect(seccion.getByRole("img")).toHaveCount(1);
      await test.info().attach(`quienes-somos-${width}`, { body: await seccion.screenshot(), contentType: "image/png" });
      await test.info().attach(`inicio-${width}`, { body: await page.locator(".s-hero").screenshot(), contentType: "image/png" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  } finally {
    await db.club.update({ where, data: { marca: marca === null ? Prisma.DbNull : marca as Prisma.InputJsonValue } });
    await db.$disconnect();
  }
});
