import { expect, request as pedidos, test as setup } from "@playwright/test";
import { BASE_URL, estadoPath } from "./env";
import { PNG_1X1 } from "./helpers";

/**
 * Deja al socio de demo en el único estado desde el que se puede pedir: legajo verificado.
 *
 * Se hace por los endpoints reales (los mismos que usa la pantalla) para que la preparación sea
 * rápida y no dependa de dónde está cada botón — la pantalla del trámite tiene su propio test en
 * `portal/verificacion.spec.ts`. Si el trámite o la aprobación se rompen, esto se pone rojo igual.
 */
setup("el socio presenta su REPROCANN y el club lo valida", async () => {
  const socio = await pedidos.newContext({ baseURL: BASE_URL, storageState: estadoPath("socio") });

  const presentacion = await socio.post("/api/portal/verificacion", {
    data: {
      dni: "30111222",
      nacimiento: "1988-04-12",
      reprocann: "REP-000111",
      vence: "2027-06-30",
      entrega: "RETIRO",
    },
  });
  expect(presentacion.status(), await presentacion.text()).toBe(200);

  for (const tipo of ["DNI_FRENTE", "DNI_DORSO", "REPROCANN"]) {
    const subida = await socio.post(`/api/portal/verificacion/documentos?tipo=${tipo}`, {
      headers: { "content-type": "image/png" },
      data: PNG_1X1,
    });
    expect(subida.status(), `${tipo}: ${await subida.text()}`).toBe(200);
  }

  const estado = await (await socio.get("/api/portal/verificacion")).json();
  expect(estado.estado).toBe("EN_REVISION");
  const id = estado.presentacion?.id as string | undefined;
  expect(id, "el trámite tiene que tener un id para que el club lo revise").toBeTruthy();

  const admin = await pedidos.newContext({ baseURL: BASE_URL, storageState: estadoPath("admin") });
  const decision = await admin.post(`/api/verificaciones/${id}/decision`, { data: { decision: "APROBAR" } });
  expect(decision.status(), await decision.text()).toBe(200);
  const respuesta = await decision.json();
  expect(respuesta.legajo).toBe(1);
  expect(respuesta.mensaje).toContain("validado");

  const despues = await (await socio.get("/api/portal/verificacion")).json();
  expect(despues.estado).toBe("VERIFICADO");
  expect(despues.puedeOperar).toBe(true);

  await socio.dispose();
  await admin.dispose();
});
