-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERADOR', 'SOCIO');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('PENDIENTE', 'ACTIVO', 'SUSPENDIDO', 'BAJA');

-- CreateEnum
CREATE TYPE "ReprocannStatus" AS ENUM ('NO_APORTA', 'EN_TRAMITE', 'VIGENTE', 'VENCIDO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "ConsumptionType" AS ENUM ('LUDICO', 'TERAPEUTICO');

-- CreateEnum
CREATE TYPE "OriginType" AS ENUM ('SEMILLA', 'ESQUEJE', 'COSECHA_PROPIA', 'PROVEEDOR_EXTERNO');

-- CreateEnum
CREATE TYPE "BatchStage" AS ENUM ('PROPAGACION', 'VEGETATIVO', 'FLORACION', 'COSECHA', 'CURADO', 'DISPONIBLE', 'AGOTADO', 'DESTRUIDO');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('INGRESO', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'DISPENSACION', 'DISPENSACION_REVERSA', 'DESTRUCCION', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "SignatureType" AS ENUM ('PIN', 'FIRMA_DIGITAL', 'QR');

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "nombre" TEXT NOT NULL,
    "cuit" TEXT,
    "reprocannNumber" TEXT,
    "reprocannCode" TEXT,
    "directorMedico" TEXT,
    "responsableTecnico" TEXT,
    "limiteDiarioG" DECIMAL(6,2) NOT NULL DEFAULT 25,
    "limiteMensualG" DECIMAL(6,2) NOT NULL DEFAULT 50,
    "limiteMenorG" DECIMAL(6,2) NOT NULL DEFAULT 30,
    "edadMinima" INTEGER NOT NULL DEFAULT 18,
    "edadLimiteMenor" INTEGER NOT NULL DEFAULT 21,
    "thcMaxMenor" DECIMAL(5,2),
    "maxSocios" INTEGER NOT NULL DEFAULT 500,
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERADOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "memberId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "legajo" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "docType" TEXT NOT NULL DEFAULT 'DNI',
    "docNumber" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" "MemberStatus" NOT NULL DEFAULT 'PENDIENTE',
    "statusReason" TEXT,
    "admittedAt" DATE,
    "leftAt" DATE,
    "reprocannNumber" TEXT,
    "reprocannStatus" "ReprocannStatus" NOT NULL DEFAULT 'NO_APORTA',
    "reprocannExpiresAt" DATE,
    "consumptionType" "ConsumptionType" NOT NULL DEFAULT 'LUDICO',
    "monthlyForecastG" DECIMAL(6,2),
    "consentSignedAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strain" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genetics" TEXT,
    "thcPct" DECIMAL(5,2),
    "cbdPct" DECIMAL(5,2),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Strain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "strainId" TEXT NOT NULL,
    "originType" "OriginType" NOT NULL DEFAULT 'SEMILLA',
    "originProviderName" TEXT,
    "originProviderAddress" TEXT,
    "originReference" TEXT,
    "plantsCount" INTEGER,
    "room" TEXT,
    "stage" "BatchStage" NOT NULL DEFAULT 'PROPAGACION',
    "plantedAt" DATE,
    "harvestedAt" DATE,
    "wetWeightG" DECIMAL(10,2),
    "dryWeightG" DECIMAL(10,2),
    "thcPct" DECIMAL(5,2),
    "cbdPct" DECIMAL(5,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "grams" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "memberId" TEXT,
    "dispensationId" TEXT,
    "transportId" TEXT,
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispensation" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "grams" DECIMAL(10,2) NOT NULL,
    "thcPct" DECIMAL(5,2),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operatorId" TEXT NOT NULL,
    "signatureType" "SignatureType" NOT NULL DEFAULT 'PIN',
    "signatureRef" TEXT,
    "limitSnapshot" JSONB NOT NULL,
    "notes" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "Dispensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transport" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "grams" DECIMAL(10,2) NOT NULL,
    "strainIds" JSONB,
    "driverId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Transport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_memberId_key" ON "User"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_legajo_key" ON "Member"("legajo");

-- CreateIndex
CREATE UNIQUE INDEX "Member_docNumber_key" ON "Member"("docNumber");

-- CreateIndex
CREATE INDEX "Member_status_idx" ON "Member"("status");

-- CreateIndex
CREATE INDEX "Member_lastName_firstName_idx" ON "Member"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Strain_name_key" ON "Strain"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_code_key" ON "Batch"("code");

-- CreateIndex
CREATE INDEX "Batch_stage_idx" ON "Batch"("stage");

-- CreateIndex
CREATE INDEX "Batch_strainId_idx" ON "Batch"("strainId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_dispensationId_key" ON "StockMovement"("dispensationId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_reversalOfId_key" ON "StockMovement"("reversalOfId");

-- CreateIndex
CREATE INDEX "StockMovement_batchId_occurredAt_idx" ON "StockMovement"("batchId", "occurredAt");

-- CreateIndex
CREATE INDEX "StockMovement_memberId_occurredAt_idx" ON "StockMovement"("memberId", "occurredAt");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE INDEX "Dispensation_memberId_occurredAt_idx" ON "Dispensation"("memberId", "occurredAt");

-- CreateIndex
CREATE INDEX "Dispensation_batchId_idx" ON "Dispensation"("batchId");

-- CreateIndex
CREATE INDEX "Transport_occurredAt_idx" ON "Transport"("occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_strainId_fkey" FOREIGN KEY ("strainId") REFERENCES "Strain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_dispensationId_fkey" FOREIGN KEY ("dispensationId") REFERENCES "Dispensation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "Transport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "StockMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispensation" ADD CONSTRAINT "Dispensation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispensation" ADD CONSTRAINT "Dispensation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispensation" ADD CONSTRAINT "Dispensation_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispensation" ADD CONSTRAINT "Dispensation_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
