// Aplica las migraciones pendientes a la base de STAGING desde el build de Vercel.
// Doble candado: si la base no es staging (huella 2f21e9740a9a), aborta sin tocar nada.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const ESPERADA = "2f21e9740a9a";
const PROD = "f04e602c11be";
// El DDL va por el host directo (sin -pooler), igual que en producción.
const sinPooler = (url) => url.replace(/-pooler/, "");

const url = process.env.DATABASE_URL ?? "";
const directa = process.env.DIRECT_URL || url;
const m = url.match(/@([^/:]+)\/([^?]+)/);
if (!m) {
  console.error("[migrar-staging] no hay DATABASE_URL");
  process.exit(1);
}
const [, host, base] = m;
const huella = createHash("sha256").update(`${host}/${base}`).digest("hex").slice(0, 12);
console.log(`[migrar-staging] huella: ${huella} · esperada (staging): ${ESPERADA}`);

if (huella === PROD) {
  console.error("[migrar-staging] ESTA ES PRODUCCIÓN: no migro");
  process.exit(1);
}
if (huella !== ESPERADA) {
  console.error("[migrar-staging] esta base no es staging: no migro");
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: sinPooler(directa) };

const correr = (args) => {
  const r = spawnSync("npx", ["prisma", ...args], { env, encoding: "utf8" });
  const salida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return { code: r.status ?? 1, salida };
};

const mostrar = (txt, lineas = 14) => {
  const l = txt.split("\n").filter((x) => x.trim());
  console.log(l.slice(-lineas).join("\n"));
};

const estado = correr(["migrate", "status"]);
mostrar(estado.salida, 20);

const intentar = () => correr(["migrate", "deploy"]);

let primer = intentar();
mostrar(primer.salida, 24);

// P3009: quedó una fila de un intento anterior marcada como fallida. Se resuelve y se reintenta.
if (primer.code !== 0 && /P3009/.test(primer.salida)) {
  const pendiente = (primer.salida.match(/(\d{14}_[a-z0-9_]+)/i) || [])[1];
  console.log(`[migrar-staging] P3009 en ${pendiente ?? "?"}: marco rolled-back y reintento`);
  if (pendiente) mostrar(correr(["migrate", "resolve", "--rolled-back", pendiente]).salida, 8);
  primer = intentar();
  mostrar(primer.salida, 24);
}

// Si sigue fallando, la base está fuera de sincronía con el historial: se rehace desde cero.
// El candado de arriba ya garantizó que esta base es staging y no producción.
if (primer.code !== 0) {
  console.log("[migrar-staging] base desincronizada: reset desde cero y replay de las migraciones");
  const reset = correr(["migrate", "reset", "--force", "--skip-seed"]);
  mostrar(reset.salida, 24);

  if (reset.code === 0) {
    const seed = spawnSync("npm", ["run", "db:seed"], { env, encoding: "utf8" });
    console.log(`[migrar-staging] seed exit=${seed.status ?? 1}`);
    mostrar(`${seed.stdout ?? ""}${seed.stderr ?? ""}`, 10);
    primer = intentar();
    mostrar(primer.salida, 12);
  }
}

if (primer.code !== 0) {
  console.error("[migrar-staging] NO se pudo migrar staging");
  process.exit(1);
}

// Staging sin datos no sirve para probar: si la base quedó vacía, se siembra.
try {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const [{ n }] = await prisma.$queryRawUnsafe('SELECT count(*)::int AS n FROM "Member"');
  await prisma.$disconnect();
  if (Number(n) === 0) {
    console.log("[migrar-staging] base sin socios: siembro los datos de prueba");
    const seed = spawnSync("npm", ["run", "db:seed"], { env, encoding: "utf8" });
    console.log(`[migrar-staging] seed exit=${seed.status ?? 1}`);
    mostrar(`${seed.stdout ?? ""}${seed.stderr ?? ""}`, 12);
  } else {
    console.log(`[migrar-staging] base con ${n} socios: no siembro`);
  }
} catch (e) {
  console.error(`[migrar-staging] no pude contar socios: ${e?.message?.slice(0, 120)}`);
}

const fin = correr(["migrate", "status"]);
mostrar(fin.salida, 10);
console.log("[migrar-staging] OK");
