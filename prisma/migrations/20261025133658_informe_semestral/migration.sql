-- Informe semestral jurado (Res. 1780/2025). Aditivo.
CREATE TABLE "SemesterReport" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "signedById" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SemesterReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SemesterReport_period_key" ON "SemesterReport"("period");
CREATE UNIQUE INDEX "SemesterReport_supersedesId_key" ON "SemesterReport"("supersedesId");
CREATE INDEX "SemesterReport_signedAt_idx" ON "SemesterReport"("signedAt");
ALTER TABLE "SemesterReport" ADD CONSTRAINT "SemesterReport_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
