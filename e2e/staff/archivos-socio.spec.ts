import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { expect, test } from "../fixtures";
import { E2E_DATABASE_URL } from "../env";

test("administración carga y reemplaza fotos de perfil y documentos en el legajo correcto", async ({ page, browser }) => {
  const db = new PrismaClient({ datasourceUrl: E2E_DATABASE_URL });
  const socio = await db.member.create({ data: { legajo: 98031, firstName: "Prueba", lastName: "Fotos" } });
  const ruta = `/socios/${socio.id}`;
  const api = `/api/members/${socio.id}/archivos`;
  const png = await sharp({ create: { width: 12, height: 18, channels: 3, background: "#388055" } }).png().toBuffer();
  const archivo = { name: "foto.png", mimeType: "image/png", buffer: png };
  const operador = await browser.newContext({ storageState: "e2e/.state/operador.json" });
  try {
    await page.goto(ruta + "/datos");
    await expect(page.getByLabel("Cargar Foto de perfil")).toBeEnabled();
    await page.getByLabel("Cargar Foto de perfil").setInputFiles(archivo);
    await expect(page.getByRole("img", { name: "Foto del socio" })).toBeVisible();
    await expect(page.getByLabel("Reemplazar Foto de perfil")).toBeVisible();
    const foto = await operador.request.get(api + "/PERFIL");
    expect(foto.headers()["content-type"]).toBe("image/webp");
    await page.goto(ruta + "/documentacion");
    await expect(page.getByLabel("Cargar DNI (frente)")).toBeEnabled();
    await page.getByLabel("Cargar DNI (frente)").setInputFiles(archivo);
    await expect(page.getByRole("link", { name: /Ver DNI \(frente\)/ })).toBeVisible();
    expect(await (await page.request.get(api + "/DNI_FRENTE")).body()).toEqual(png);
    const guardado = await db.memberFile.findFirstOrThrow({ where: { memberId: socio.id, tipo: "DNI_FRENTE" } });
    expect(Buffer.from(guardado.data)).not.toEqual(png);
    const solicitud = await db.memberVerification.create({ data: {
      memberId: socio.id, docNumberCipher: png, docHash: "prueba-fotos", docLast4: "0031",
      birthDate: new Date("1990-01-01"), reprocannNumber: "12345", reprocannExpiresAt: new Date("2030-01-01"),
    } });
    await expect(page.getByLabel("Reemplazar DNI (frente)")).toBeEnabled();
    await page.getByLabel("Reemplazar DNI (frente)").setInputFiles(archivo);
    await expect.poll(() => db.verificationDocument.count({ where: { verificationId: solicitud.id, tipo: "DNI_FRENTE" } })).toBe(1);
    await db.memberVerification.update({ where: { id: solicitud.id }, data: { status: "VERIFICADO" } });
    await page.reload();
    await expect(page.getByLabel("Cargar DNI (dorso)")).toBeEnabled();
    await page.getByLabel("Cargar DNI (dorso)").setInputFiles({ ...archivo, buffer: Buffer.alloc(0) });
    await expect(page.getByText("El archivo está vacío.")).toBeVisible();
    await expect(page.getByLabel("Cargar DNI (dorso)")).toBeEnabled();
    await page.getByLabel("Cargar DNI (dorso)").setInputFiles(archivo);
    await expect(page.getByLabel("Reemplazar DNI (dorso)")).toBeVisible();
    expect(await db.verificationDocument.count({ where: { verificationId: solicitud.id, tipo: "DNI_DORSO" } })).toBe(0);
    expect((await operador.request.get(api + "/DNI_FRENTE")).status()).toBe(403);
    for (const tipo of ["PERFIL", "DNI_FRENTE"]) {
      expect((await operador.request.post(api + "/" + tipo, { data: png, headers: { "content-type": "image/png" } })).status()).toBe(403);
    }
    expect((await page.request.get("/api/members/inexistente/archivos/DNI_FRENTE")).status()).toBe(404);
  } finally {
    await operador.close();
    await db.member.delete({ where: { id: socio.id } });
    await db.$disconnect();
  }
});
