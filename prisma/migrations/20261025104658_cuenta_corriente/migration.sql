-- Cuenta corriente del socio: cuotas sociales y aportes de cultivo como cargos,
-- pagos y contra-asientos. Append-only: nada se edita ni se borra.
CREATE TYPE "AccountKind" AS ENUM ('CARGO', 'PAGO');
CREATE TYPE "AccountConcept" AS ENUM ('CUOTA_SOCIAL', 'CUOTA_INGRESO', 'APORTE_CULTIVO', 'AJUSTE');

ALTER TABLE "Club" ADD COLUMN "cuotaSocialArs" DECIMAL(12,2),
                   ADD COLUMN "cuotaIngresoArs" DECIMAL(12,2);

CREATE TABLE "AccountEntry" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "kind" "AccountKind" NOT NULL,
  "concept" "AccountConcept" NOT NULL,
  "amountArs" DECIMAL(12,2) NOT NULL,
  "period" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispensationId" TEXT,
  "note" TEXT,
  "createdById" TEXT,
  "reversalOfId" TEXT,
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountEntry_dispensationId_key" ON "AccountEntry"("dispensationId");
CREATE UNIQUE INDEX "AccountEntry_reversalOfId_key" ON "AccountEntry"("reversalOfId");
CREATE UNIQUE INDEX "AccountEntry_memberId_concept_period_key" ON "AccountEntry"("memberId", "concept", "period");
CREATE INDEX "AccountEntry_memberId_occurredAt_idx" ON "AccountEntry"("memberId", "occurredAt");

ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
