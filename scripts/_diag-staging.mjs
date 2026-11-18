// Diagnóstico de la base de staging: corre DENTRO del build de Vercel, donde DATABASE_URL
// de Preview está disponible. Aborta si la base no es la de staging (nunca imprime credenciales).
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const ESPERADA = "2f21e9740a9a"; // staging (Preview)

const url = process.env.DATABASE_URL ?? "";
const m = url.match(/@([^/:]+)\/([^?]+)/);
if (!m) {
  console.error("[diag] no hay DATABASE_URL");
  process.exit(1);
}
const [, host, base] = m;
const huella = createHash("sha256").update(`${host}/${base}`).digest("hex").slice(0, 12);
console.log(`[diag] huella: ${huella} · esperada (staging): ${ESPERADA}`);
if (huella !== ESPERADA) {
  console.error("[diag] esta base no es staging: no diagnostico");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const enums = await prisma.$queryRawUnsafe(`SELECT enum_range(NULL::"DeliveryMode")::text AS e`);
  console.log(`[diag] DeliveryMode = ${enums[0]?.e}`);

  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'PickupItem' ORDER BY column_name`
  );
  console.log(`[diag] PickupItem: ${cols.map((c) => c.column_name).join(", ")}`);

  try {
    const mig = await prisma.$queryRawUnsafe(
      `SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 4`
    );
    console.log(
      `[diag] migraciones: ${mig
        .map((x) => `${x.migration_name}${x.finished_at ? "" : " (SIN TERMINAR)"}`)
        .join(" | ")}`
    );
  } catch (e) {
    console.log(`[diag] sin tabla _prisma_migrations: ${e?.message?.slice(0, 80)}`);
  }

  const conteo = await prisma.$queryRawUnsafe(
    `SELECT (SELECT count(*) FROM "Member") AS socios, (SELECT count(*) FROM "Dispensation") AS entregas`
  );
  console.log(`[diag] datos: socios=${conteo[0]?.socios} · entregas=${conteo[0]?.entregas}`);
  console.log("[diag] OK");
} catch (e) {
  console.error(`[diag] falló: ${e?.message?.slice(0, 200)}`);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
