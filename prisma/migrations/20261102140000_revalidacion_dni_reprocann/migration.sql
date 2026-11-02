-- Re-validación de DNI + REPROCANN de los socios que ya están en el padrón.
--
-- Motivo: el club carga socios que existen desde antes del sistema (planilla de papel, padrón
-- histórico). De esos legajos no hay DNI ni REPROCANN verificados, y sin eso no se puede entregar
-- ni reservar. El trámite de re-validación es un expediente propio (no crea el legajo: lo actualiza).
--
-- `birthDate` pasa a nullable porque un socio importado puede no tener fecha de nacimiento: el
-- dato lo declara él al validarse. Inventar 1900-01-01 antes de preguntar sería un dato falso en
-- una ficha que después se imprime en los libros.

CREATE TYPE "VerificationStatus" AS ENUM ('PENDIENTE', 'EN_REVISION', 'VERIFICADO', 'RECHAZADO');

ALTER TABLE "Member" ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "Member" ADD COLUMN "verificationAt" TIMESTAMP(3);
ALTER TABLE "Member" ALTER COLUMN "birthDate" DROP NOT NULL;

-- Quien ya tiene el documento verificado (o pasó por el alta con documentos) no repite el trámite.
UPDATE "Member"
   SET "verificationStatus" = 'VERIFICADO',
       "verificationAt" = COALESCE("docVerifiedAt", "createdAt")
 WHERE "docVerifiedAt" IS NOT NULL
    OR "docHash" IS NOT NULL;

CREATE TABLE "MemberVerification" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'EN_REVISION',
    "docNumberCipher" BYTEA NOT NULL,
    "docHash" TEXT NOT NULL,
    "docLast4" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "reprocannNumber" TEXT NOT NULL,
    "reprocannExpiresAt" DATE NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    "supersedesId" TEXT,

    CONSTRAINT "MemberVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerificationDocument" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "iv" BYTEA NOT NULL,
    "tag" BYTEA NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberVerification_supersedesId_key" ON "MemberVerification"("supersedesId");
CREATE INDEX "MemberVerification_memberId_submittedAt_idx" ON "MemberVerification"("memberId", "submittedAt");
CREATE INDEX "MemberVerification_status_submittedAt_idx" ON "MemberVerification"("status", "submittedAt");
CREATE INDEX "VerificationDocument_verificationId_idx" ON "VerificationDocument"("verificationId");

ALTER TABLE "MemberVerification" ADD CONSTRAINT "MemberVerification_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberVerification" ADD CONSTRAINT "MemberVerification_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemberVerification" ADD CONSTRAINT "MemberVerification_supersedesId_fkey"
  FOREIGN KEY ("supersedesId") REFERENCES "MemberVerification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_verificationId_fkey"
  FOREIGN KEY ("verificationId") REFERENCES "MemberVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
