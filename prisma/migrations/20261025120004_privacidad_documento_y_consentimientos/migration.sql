-- REA 4: el documento se guarda como huella, no como número. Consentimiento por finalidad.
ALTER TABLE "Member" ALTER COLUMN "docNumber" DROP NOT NULL;
ALTER TABLE "Member" ADD COLUMN "docHash" TEXT;
ALTER TABLE "Member" ADD COLUMN "docLast4" TEXT;
ALTER TABLE "Member" ADD COLUMN "docVerifiedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Member_docHash_key" ON "Member"("docHash");

CREATE TYPE "ConsentPurpose" AS ENUM ('DATOS_PERSONALES', 'SALUD', 'IMAGEN', 'COMUNICACIONES');

CREATE TABLE "Consent" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "purpose" "ConsentPurpose" NOT NULL,
  "version" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "grantedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Consent_memberId_purpose_version_key" ON "Consent"("memberId", "purpose", "version");
CREATE INDEX "Consent_memberId_purpose_idx" ON "Consent"("memberId", "purpose");

ALTER TABLE "Consent" ADD CONSTRAINT "Consent_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_grantedById_fkey"
  FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
