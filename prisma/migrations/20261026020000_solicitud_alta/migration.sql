-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "locality" TEXT,
    "docType" TEXT NOT NULL DEFAULT 'DNI',
    "docHash" TEXT NOT NULL,
    "docLast4" TEXT NOT NULL,
    "docNumberCipher" BYTEA,
    "reprocannNumber" TEXT NOT NULL,
    "reprocannExpiresAt" DATE NOT NULL,
    "consumptionType" "ConsumptionType" NOT NULL DEFAULT 'LUDICO',
    "affidavitAccepted" BOOLEAN NOT NULL DEFAULT false,
    "affidavitVersion" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDIENTE',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    "memberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessDocument" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "iv" BYTEA NOT NULL,
    "tag" BYTEA NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_userId_key" ON "AccessRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_memberId_key" ON "AccessRequest"("memberId");

-- CreateIndex
CREATE INDEX "AccessRequest_status_submittedAt_idx" ON "AccessRequest"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "AccessDocument_requestId_idx" ON "AccessDocument"("requestId");

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessDocument" ADD CONSTRAINT "AccessDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AccessRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
