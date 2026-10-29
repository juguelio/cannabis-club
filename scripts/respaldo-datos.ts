/**
 * Respaldo lógico de las tablas operativas antes de una limpieza, en JSON.
 *
 *   npx tsx scripts/respaldo-datos.ts                 # escribe el respaldo y muestra el conteo
 *   npx tsx scripts/respaldo-datos.ts --tablas=Member,User
 *
 * Usa `row_to_json` por tabla: copia todas las columnas tal cual (los bytea salen en hex), sin depender
 * de la versión del cliente de Postgres. Sirve para volver atrás una limpieza de datos de demostración.
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

const prisma = new PrismaClient();

const OPERATIVAS = [
  "Dispensation",
  "StockMovement",
  "AccountEntry",
  "PickupRequest",
  "Appointment",
  "NoticeLog",
  "AccessDocument",
  "AccessRequest",
  "Batch",
  "Strain",
  "Member",
  "User",
];

async function main() {
  const arg = process.argv.find((a) => a.startsWith("--tablas="));
  const tablas = arg ? arg.split("=")[1].split(",").map((t) => t.trim()).filter(Boolean) : OPERATIVAS;

  const datos: Record<string, unknown[]> = {};
  for (const tabla of tablas) {
    const filas = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT row_to_json(t) AS fila FROM "${tabla}" t`);
    datos[tabla] = filas.map((f) => f.fila);
    console.log(`  ${String(datos[tabla].length).padStart(5)}  ${tabla}`);
  }

  const host = (process.env.DATABASE_URL ?? "").replace(/\/\/[^@]*@/, "//***@").split("?")[0];
  const carpeta = `${homedir()}/RoccoWork/backups`;
  mkdirSync(carpeta, { recursive: true });
  const archivo = `${carpeta}/datos-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(archivo, JSON.stringify({ host, cuando: new Date().toISOString(), tablas: datos }, null, 1), { mode: 0o600 });
  console.log(`\nrespaldo: ${archivo}`);
  console.log(`filas: ${Object.values(datos).reduce((n, f) => n + f.length, 0)}`);
}

main().finally(() => prisma.$disconnect());
