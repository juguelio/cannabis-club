/**
 * Backfill de privacidad (REA 4): convierte los documentos en claro en huellas y
 * siembra los consentimientos que el padrón ya tenía firmados.
 *
 * Lee el número con SQL crudo a propósito: este script corre **antes** de la migración que
 * borra la columna, y así funciona con un cliente Prisma que ya no la conoce.
 *
 * - Idempotente: correr dos veces no cambia nada (sólo toca filas sin huella).
 * - Falla (exit 1) si queda algún socio sin huella: en ese caso NO se corre la migración del drop.
 *
 *   DATABASE_URL=... [DOC_HASH_KEY=...] npx tsx scripts/backfill-privacy.ts
 */
import { PrismaClient } from "@prisma/client";
import { docFingerprint, CONSENT_VERSION } from "../src/lib/privacy";

const prisma = new PrismaClient();

type Row = { id: string; legajo: number; docNumber: string | null; consentSignedAt: Date | null };

async function main() {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, legajo, "docNumber", "consentSignedAt"
    FROM "Member"
    WHERE "docHash" IS NULL AND "docNumber" IS NOT NULL
  `;

  let hashed = 0;
  let consents = 0;

  for (const m of rows) {
    const fp = docFingerprint(m.docNumber!);
    await prisma.member.update({
      where: { id: m.id },
      data: { docHash: fp.docHash, docLast4: fp.docLast4, docVerifiedAt: m.consentSignedAt ?? new Date() },
    });
    hashed += 1;

    if (m.consentSignedAt) {
      for (const purpose of ["DATOS_PERSONALES", "SALUD"] as const) {
        const exists = await prisma.consent.findFirst({ where: { memberId: m.id, purpose } });
        if (exists) continue;
        await prisma.consent.create({
          data: { memberId: m.id, purpose, version: CONSENT_VERSION, grantedAt: m.consentSignedAt, note: "Migrado del consentimiento único previo." },
        });
        consents += 1;
      }
    }
  }

  const sinHuella = await prisma.member.count({ where: { docHash: null } });
  console.log(JSON.stringify({ hashed, consents, sinHuella }, null, 2));
  if (sinHuella > 0) {
    console.error("Quedan socios sin huella: NO correr la migración que borra el documento.");
    process.exitCode = 1;
  }
}

main().finally(() => prisma.$disconnect());
