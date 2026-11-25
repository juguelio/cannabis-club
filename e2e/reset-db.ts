import { execFileSync } from "node:child_process";
import { E2E_DATABASE_URL, E2E_DB_NAME, psqlUrl } from "./env";

/**
 * Deja la base de los tests como recién instalada: la borra, la crea, corre las migraciones y
 * siembra los datos de demo.
 *
 * Corre **antes** de levantar el servidor (lo llama `scripts/e2e-server.sh`), nunca con el servidor
 * ya arriba: si se tira la base mientras el pool de Prisma está conectado, todas las consultas
 * siguientes mueren con «terminating connection due to administrator command» y los tests fallan por
 * el arnés, no por la app.
 */
function psql(url: string, sql: string) {
  execFileSync("psql", [psqlUrl(url), "-v", "ON_ERROR_STOP=1", "-q", "-c", sql], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

if (!E2E_DATABASE_URL) throw new Error("Falta DATABASE_URL en .env: no sé contra qué servidor crear la base de test");
if (new URL(E2E_DATABASE_URL).pathname !== "/" + E2E_DB_NAME || process.env.DATABASE_URL !== E2E_DATABASE_URL) {
  throw new Error(`La base de test tiene que llamarse ${E2E_DB_NAME}: ${E2E_DATABASE_URL.replace(/\/\/.*@/, "//***@")}`);
}

const raiz = psqlUrl(E2E_DATABASE_URL);
const admin = raiz.replace(/\/[^/]+$/, "/postgres");

psql(admin, `DROP DATABASE IF EXISTS "${E2E_DB_NAME}" WITH (FORCE)`);
psql(admin, `CREATE DATABASE "${E2E_DB_NAME}"`);

const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL, DIRECT_URL: E2E_DATABASE_URL };
execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "pipe", env });
execFileSync("npm", ["run", "db:seed"], { stdio: "pipe", env });

// La suite crea varios pedidos con el mismo socio; con el tope de 50 g del club se queda sin margen a
// mitad de camino y los últimos tests fallan por cupo, no por la app. Se le da aire sólo acá.
psql(E2E_DATABASE_URL, `UPDATE "Club" SET "limiteMensualG" = 150 WHERE "limiteMensualG" < 150`);

console.log(`[e2e] base ${E2E_DB_NAME} recreada, migrada y sembrada (tope mensual ampliado para los tests)`);
