import { expect, test as setup } from "@playwright/test";
import { CRED, estadoPath, type Rol } from "./env";
import { login } from "./helpers";

/**
 * Un sólo login por rol, y de ahí en adelante los tests arrancan con la sesión puesta.
 *
 * Se entra por la pantalla real (no se inyecta un token): si el formulario se rompe, esto se pone
 * rojo y todos los tests que dependen de él también — que es exactamente lo que se quiere saber.
 */
const roles: Array<[Rol, string]> = [
  ["admin", "/"],
  ["operador", "/"],
  ["socio", "/portal"],
];

for (const [rol, destino] of roles) {
  setup(`entra como ${rol}`, async ({ page }) => {
    await login(page, rol);

    // El rol define dónde cae: el club va al tablero, el socio a su portal.
    expect(new URL(page.url()).pathname, `${rol} tiene que quedar en ${destino}`).toBe(destino);
    await expect(page.locator("body")).not.toContainText("Email o contraseña incorrectos");

    // Y la cookie sirve de verdad: una pantalla protegida responde sin volver al login.
    const protegida = rol === "socio" ? "/portal/datos" : "/socios";
    await page.goto(protegida);
    await expect(page).toHaveURL(new RegExp(`${protegida.replace(/\//g, "\\/")}`));

    await page.context().storageState({ path: estadoPath(rol) });
    expect(CRED[rol].email).toContain("@");
  });
}
