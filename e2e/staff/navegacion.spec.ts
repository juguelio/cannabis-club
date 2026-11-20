import { expect, test } from "../fixtures";

/**
 * Recorrido completo del club: cada pantalla del equipo tiene que abrir, saludar con su título y no
 * romperse. Es la red que atrapa lo más común y lo más caro: un deploy que deja una pantalla en 500
 * y nadie se entera hasta que el club la necesita.
 */
const pantallas: Array<[string, string]> = [
  ["/", "Buenas"],
  ["/socios", "Socios"],
  ["/socios/nuevo", "Alta"],
  ["/stock", "Stock y lotes"],
  ["/dispensario", "Dispensario"],
  ["/pedidos", "Pedidos"],
  ["/aportes", "Aportes"],
  ["/traslados", "Traslados"],
  ["/turnos", "Turnos"],
  ["/calendario", "Calendario"],
  ["/reportes", "Libros"],
  ["/control", "Control"],
  ["/cierre", "Cierre del día"],
  ["/avisos", "Avisos"],
  ["/configuracion", "Configuración"],
  ["/cartas", "Cartas"],
  ["/inspeccion", "Modo inspección"],
  ["/informe-semestral", "Informe semestral"],
];

for (const [ruta, titulo] of pantallas) {
  test(`${ruta} abre y se identifica`, async ({ page }) => {
    const resp = await page.goto(ruta, { waitUntil: "domcontentloaded" });
    expect(resp?.status(), `${ruta} tiene que responder 200`).toBe(200);

    const h1 = page.locator("h1").first();
    await expect(h1).toContainText(titulo);
    await expect(page.locator("body")).not.toContainText(/Application error|Internal Server Error/);
  });
}

test("el menú del club lleva a las pantallas principales", async ({ page }) => {
  await page.goto("/");
  // El tablero tiene que ofrecer el camino corto a lo que se usa todos los días.
  await expect(page.locator("body")).toContainText(/Socios|Dispensario|Stock/);
});

test("el operador atiende el mostrador, pero configuración es del administrador", async ({ browser }) => {
  const contexto = await browser.newContext({ storageState: "e2e/.state/operador.json" });
  const pagina = await contexto.newPage();

  for (const ruta of ["/dispensario", "/pedidos", "/turnos", "/stock"]) {
    await pagina.goto(ruta);
    expect(new URL(pagina.url()).pathname, `el operador tiene que poder abrir ${ruta}`).toBe(ruta);
  }

  // `configuracion/page.tsx` corta a todo lo que no sea ADMIN: el operador vuelve al tablero.
  await pagina.goto("/configuracion");
  expect(new URL(pagina.url()).pathname).toBe("/");

  await contexto.close();
});
