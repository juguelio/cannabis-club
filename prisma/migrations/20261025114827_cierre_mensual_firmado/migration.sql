-- Cierre mensual firmado (estilo Uruguay): totales congelados con firma y huella.
CREATE TABLE "MonthlyClose" (
  "id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "hash" TEXT NOT NULL,
  "signedById" TEXT NOT NULL,
  "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "supersedesId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonthlyClose_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonthlyClose_period_key" ON "MonthlyClose"("period");
CREATE UNIQUE INDEX "MonthlyClose_supersedesId_key" ON "MonthlyClose"("supersedesId");
CREATE INDEX "MonthlyClose_signedAt_idx" ON "MonthlyClose"("signedAt");

ALTER TABLE "MonthlyClose" ADD CONSTRAINT "MonthlyClose_signedById_fkey"
  FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
