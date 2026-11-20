import { expect, type Page } from "@playwright/test";
import { CRED, type Rol } from "./env";

/**
 * Entra con un rol por la pantalla real.
 *
 * El formulario es cliente: si el click llega antes de que React hidrate, el navegador hace el envío
 * nativo. Por eso se espera a que la página termine de pedir cosas y, si el envío no pasó nada, se
 * reintenta una vez con la página ya hidratada — en vez de dormir un tiempo fijo y rezar.
 */
export async function login(page: Page, rol: Rol) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await completar(page, rol);

  for (let intento = 0; intento < 2; intento++) {
    try {
      await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 8_000 });
      return;
    } catch {
      if (intento === 1) throw new Error(`no se pudo entrar como ${rol}: sigue en ${page.url()}`);
      await page.goto("/login", { waitUntil: "networkidle" });
      await completar(page, rol);
    }
  }
}

async function completar(page: Page, rol: Rol) {
  await page.getByLabel("Email").fill(CRED[rol].email);
  await page.getByLabel("Contraseña", { exact: true }).fill(CRED[rol].password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
}

/** Espera a que la pantalla termine de pedir datos, sin adivinar tiempos fijos. */
export async function sinCargando(page: Page) {
  await expect(page.locator("text=Cargando…")).toHaveCount(0, { timeout: 15_000 });
}

/** Un PNG de 1×1 válido: sirve como «foto del comprobante» sin arrastrar archivos binarios al repo. */
export const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

/** Códigos que crea `prisma/seed.ts`: si cambian allá, cambian acá y los tests lo dicen. */
export const SEED = {
  club: "Asociación Civil República ONG",
  socio: { nombre: "María Gómez", legajo: 1 },
  otroSocio: { nombre: "Julián Pérez", legajo: 2 },
  vencido: { nombre: "Ana Ruiz", legajo: 3 },
  lotes: ["L-2026-001", "L-2026-002", "L-2026-003", "L-2026-004", "L-2026-005"],
} as const;

/**
 * Elige «Retiro en el club» y reserva el primer horario libre de un día.
 *
 * `dia` es cuál de los días con horarios usar. Cada test toma un día distinto a propósito: el club no
 * acepta dos pedidos sobre el mismo turno (`appointmentId` es único) y rechazarlos está bien — lo que
 * no puede pasar es que dos tests se peleen por el mismo.
 *
 * Se prueban los días uno por uno porque el primero del selector es hoy y, si el club ya cerró, no le
 * queda ningún horario libre.
 */
export async function elegirRetiro(page: Page, dia = 0) {
  await page.getByRole("button", { name: /Retiro en el club/ }).click();

  const dias = page.getByRole("radiogroup", { name: "Día del retiro" }).getByRole("button");
  const total = await dias.count();
  const slots = page.locator(".slot");
  const conHorario: number[] = [];

  for (let i = 0; i < total; i += 1) {
    if ((await dias.nth(i).getAttribute("aria-disabled")) === "true") continue;
    await dias.nth(i).click();
    const hay = await slots.first().waitFor({ state: "visible", timeout: 1_200 }).then(() => true).catch(() => false);
    if (hay) conHorario.push(i);
  }

  if (!conHorario.length) throw new Error("el club no tiene ningún día con horario libre");
  const elegido = conHorario[dia % conHorario.length];
  await dias.nth(elegido).click();
  await slots.first().waitFor({ state: "visible", timeout: 5_000 });
  await slots.first().click();
}

/**
 * Arma un pedido de retiro y llega hasta la pantalla de pago.
 *
 * Cada paso espera la señal concreta (el basket dice 5 g, el botón de continuar está habilitado) en vez
 * de un tiempo fijo. `dia` separa los pedidos de tests distintos: el club no acepta dos para el mismo
 * día y horario, y tiene razón en no aceptarlos.
 */
export async function irAlPago(page: Page, gramos = "5 g", dia = 0) {
  await page.goto("/portal", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: new RegExp(`^${gramos}`) }).first().click();

  // Se comprueba en el basket: en el celular el panel del carrito vive en un cajón y el texto no está
  // en la página hasta abrirlo.
  await page.goto("/portal/basket", { waitUntil: "networkidle" });
  await expect(page.locator("body")).toContainText(new RegExp(gramos));

  await page.goto("/portal/pedido", { waitUntil: "networkidle" });
  await elegirRetiro(page, dia);

  const continuar = page.getByRole("button", { name: /Continuar al pago/ });
  await expect(continuar).toBeEnabled();

  const respuestas: string[] = [];
  const escuchar = (r: import("@playwright/test").Response) => {
    if (r.url().includes("/api/portal/pickups")) respuestas.push(`${r.status()}`);
  };
  page.on("response", escuchar);
  try {
    // Si el turno elegido ya está tomado (el club no permite dos pedidos sobre el mismo turno), se
    // prueba otro día. Otro test pudo haber reservado ese horario antes: es esperable, no un bug.
    for (let intento = 0; intento < 4; intento += 1) {
      await continuar.click();
      const llego = await page
        .waitForURL(/\/portal\/pedido\/pago\//, { timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      if (llego) return;

      const pantalla = (await page.locator(".form-error, [role=alert]").allInnerTexts().catch(() => [])).join(" / ");
      if (!/ya ten[eé]s un pedido/i.test(pantalla)) {
        throw new Error(`el pedido no llegó al pago · respuestas: ${respuestas.join(", ") || "ninguna"} · pantalla: ${pantalla.slice(0, 200)}`);
      }
      await elegirRetiro(page, dia + intento + 1);
    }
    throw new Error(`el pedido no llegó al pago tras 4 intentos · respuestas: ${respuestas.join(", ") || "ninguna"}`);
  } finally {
    page.off("response", escuchar);
  }
}

/**
 * Elige al socio en el mostrador usando el buscador (legajo, apellido o DNI), que es como lo hace el
 * club: la fila de «Esperados hoy» se puede tocar, pero el buscador siempre está y no depende del día.
 */
export async function elegirSocioEnMostrador(page: Page, texto = "Gómez", legajo = 1) {
  await page.goto("/dispensario");
  await page.getByPlaceholder("Legajo, apellido o DNI").fill(texto);

  const opcion = page.getByRole("option", { name: new RegExp(texto, "i") }).first();
  await expect(opcion).toBeVisible({ timeout: 10_000 });
  await opcion.click();
  await expect(page.locator("body")).toContainText(new RegExp(`Legajo ${legajo}`));
}

/**
 * Crea un pedido de retiro por la API del portal, tomando un horario que esté libre de verdad.
 *
 * Se usa cuando el test no trata sobre «armar el pedido» sino sobre lo que viene después (subir el
 * comprobante, aprobarlo). La grilla puede ofrecer un horario que ya tiene un pedido sin aprobar: se
 * recorre hasta encontrar uno que el club acepte, que es lo que haría el socio.
 */
export async function crearPedido(page: Page, gramos = 5): Promise<string> {
  // Los pedidos abiertos ocupan turnos: se cancelan los que dejaron otros tests para que este tenga
  // lugar. El club los libera al cancelarlos, igual que cuando el socio se arrepiente.
  const abiertos = await (await page.request.get("/api/portal/overview")).json();
  for (const pedido of (abiertos.pickups ?? []) as Array<{ id: string; status: string }>) {
    if (["SOLICITADA", "CONFIRMADA", "PREPARANDO", "LISTA"].includes(pedido.status)) {
      await page.request.post(`/api/portal/pickups/${pedido.id}/cancel`, { data: { motivo: "test" } });
    }
  }

  const grilla = await (await page.request.get("/api/portal/slots")).json();
  const dias = (grilla.days as Array<{ key: string; estado?: string }>).filter((d) => (d.estado ?? "abierto") === "abierto");

  for (const dia of dias) {
    const delDia = await (await page.request.get(`/api/portal/slots?date=${dia.key}`)).json();
    const libres = (delDia.slots as Array<{ startMin: number; past: boolean; full: boolean }>).filter((s) => !s.past && !s.full);

    for (const libre of libres) {
      const resp = await page.request.post("/api/portal/pickups", {
        data: { mode: "RETIRO", grams: gramos, date: dia.key, startMin: libre.startMin },
      });
      if (resp.status() === 201) {
        const { pickup } = await resp.json();
        return pickup.id as string;
      }
      const cuerpo = await resp.text();
      if (!cuerpo.includes("PEDIDO_DUPLICADO")) throw new Error(`no se pudo crear el pedido: ${resp.status()} ${cuerpo}`);
    }
  }
  throw new Error("el club no tiene horarios libres para crear el pedido");
}
