-- CreateEnum
CREATE TYPE "PickupStatus" AS ENUM ('SOLICITADA', 'CONFIRMADA', 'RETIRADA', 'VENCIDA', 'CANCELADA');

-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "aportePorGramo" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "PickupRequest" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "grams" DECIMAL(10,2) NOT NULL,
    "status" "PickupStatus" NOT NULL DEFAULT 'SOLICITADA',
    "appointmentId" TEXT,
    "aportePorGramo" DECIMAL(10,2),
    "aporteEstimado" DECIMAL(12,2),
    "limitSnapshot" JSONB,
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "dispensationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PickupRequest_appointmentId_key" ON "PickupRequest"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PickupRequest_dispensationId_key" ON "PickupRequest"("dispensationId");

-- CreateIndex
CREATE INDEX "PickupRequest_memberId_createdAt_idx" ON "PickupRequest"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "PickupRequest_status_createdAt_idx" ON "PickupRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PickupRequest" ADD CONSTRAINT "PickupRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupRequest" ADD CONSTRAINT "PickupRequest_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupRequest" ADD CONSTRAINT "PickupRequest_dispensationId_fkey" FOREIGN KEY ("dispensationId") REFERENCES "Dispensation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
