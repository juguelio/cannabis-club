-- Lote en cuarentena: bloquea entregas hasta liberarlo.
ALTER TYPE "BatchStage" ADD VALUE IF NOT EXISTS 'CUARENTENA' BEFORE 'AGOTADO';

-- Días cerrados: el dispensario no atiende y no se aceptan reservas.
CREATE TABLE "ClosedDay" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClosedDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClosedDay_date_key" ON "ClosedDay"("date");
