import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { BASE_URL } from "./e2e/env";

/**
 * E2E de la app del club.
 *
 * Reglas que sostienen la confiabilidad:
 * - **Base propia** (`cannabis_club_e2e`), recreada y sembrada en cada corrida: los tests pueden
 *   ensuciar sin miedo y el resultado no depende de lo que alguien hizo a mano ayer.
 * - **Un worker**: el club es un sistema con estado compartido (ledger, topes, cupos); en paralelo
 *   los tests se pisan entre sí y el rojo no significa nada.
 * - **Servidor de producción** (`next start`), no `next dev`: lo que se prueba es lo que se publica.
 * - Traza y captura sólo cuando algo falla, para que el reporte sirva y no pese 200 MB.
 */
// Los workers y el servidor de esta corrida comparten una clave efímera.
process.env.E2E_AUTH_SECRET ??= randomBytes(32).toString("base64");

export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e/.resultados",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/.reporte" }]],
  use: {
    baseURL: BASE_URL,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "preparacion",
      testMatch: /(auth|onboarding)\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "publico",
      testDir: "e2e/publico",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "movil",
      testDir: "e2e/movil",
      dependencies: ["preparacion"],
      use: { ...devices["Pixel 7"], storageState: "e2e/.state/socio.json" },
    },
    {
      name: "staff",
      testDir: "e2e/staff",
      dependencies: ["preparacion"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.state/admin.json" },
    },
    {
      name: "portal",
      testDir: "e2e/portal",
      dependencies: ["preparacion"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.state/socio.json" },
    },
    {
      name: "api",
      testDir: "e2e/api",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bash scripts/e2e-server.sh",
    url: `${BASE_URL}/api/health`,
    // Siempre servidor nuevo: uno viejo seguiría apuntando a la base anterior.
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
