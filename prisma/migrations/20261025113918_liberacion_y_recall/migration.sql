-- Liberación con firma, ficha técnica y recall del lote (REA 5.1–5.4).
ALTER TYPE "BatchStage" ADD VALUE 'RETIRADO';

ALTER TABLE "Club" ADD COLUMN "requiereLiberacion" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Batch"
  ADD COLUMN "releasedAt" TIMESTAMP(3),
  ADD COLUMN "releasedById" TEXT,
  ADD COLUMN "releaseNote" TEXT,
  ADD COLUMN "labName" TEXT,
  ADD COLUMN "labDate" DATE,
  ADD COLUMN "labResult" TEXT,
  ADD COLUMN "sampleRetainedG" DECIMAL(10,2),
  ADD COLUMN "sampleUntil" DATE,
  ADD COLUMN "recalledAt" TIMESTAMP(3),
  ADD COLUMN "recallReason" TEXT;

-- Backfill honesto: los lotes que ya estaban disponibles se consideran liberados antes de esta regla.
UPDATE "Batch"
   SET "releasedAt" = "updatedAt",
       "releaseNote" = 'Liberado antes de la firma de calidad (migración 25-oct-2026)'
 WHERE "stage" = 'DISPONIBLE' AND "releasedAt" IS NULL;
