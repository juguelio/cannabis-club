import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * El puerto 3000 es del bridge de WhatsApp y el 3300 del `next dev` de siempre:
 * los tests usan el 3500 para no pisar ninguno de los dos.
 */
export const PORT = 3500;
export const BASE_URL = `http://127.0.0.1:${PORT}`;

/** Base propia de los tests. Nunca se corre nada contra `cannabis_club_dev` ni contra Neon. */
export const E2E_DB_NAME = "cannabis_club_e2e";

function leerEnv(): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const crudo of readFileSync(resolve(process.cwd(), ".env"), "utf8").split("\n")) {
    const linea = crudo.trim();
    if (!linea || linea.startsWith("#")) continue;
    const corte = linea.indexOf("=");
    if (corte < 0) continue;
    salida[linea.slice(0, corte).trim()] = linea.slice(corte + 1).trim().replace(/^["']|["']$/g, "");
  }
  return salida;
}

const env = leerEnv();

/** La URL de desarrollo, tal cual está en `.env` (para poder mostrar contra qué base se corrió). */
export const DATABASE_URL_DEV = env.DATABASE_URL ?? "";

/**
 * Cambia el nombre de la base sin tocar host, puerto ni credenciales.
 * `?schema=public` se conserva: Prisma lo entiende y psql lo ignora cuando se le pasa la URL limpia.
 */
export function conBase(url: string, base: string): string {
  const [sinQuery, query] = url.split("?");
  const corte = sinQuery.lastIndexOf("/");
  const conNombre = `${sinQuery.slice(0, corte)}/${base}`;
  return query ? `${conNombre}?${query}` : conNombre;
}

export const E2E_DATABASE_URL = DATABASE_URL_DEV ? conBase(DATABASE_URL_DEV, E2E_DB_NAME) : "";

/** URL para psql: sin parámetros de query. */
export const psqlUrl = (url: string) => url.split("?")[0];

export const CRED = {
  admin: { email: "admin@club.test", password: "Admin1234!", nombre: "Admin Demo" },
  operador: { email: "operador@club.test", password: "Operador1234!", nombre: "Operador Demo" },
  socio: { email: "maria@club.test", password: "Socio1234!", nombre: "María Gómez" },
} as const;

export type Rol = keyof typeof CRED;

export const estadoPath = (rol: Rol) => `e2e/.state/${rol}.json`;
