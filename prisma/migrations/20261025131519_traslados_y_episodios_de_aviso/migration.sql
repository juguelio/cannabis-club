-- Traslados a distancia (el club entrega fuera de sede) y episodios de aviso. Todo aditivo.

CREATE TYPE "ShipmentMode" AS ENUM ('AEREO', 'TERRESTRE');
CREATE TYPE "ShipmentStatus" AS ENUM ('PREPARACION', 'DESPACHADO', 'ENTREGADO', 'CANCELADO');

CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "mode" "ShipmentMode" NOT NULL DEFAULT 'TERRESTRE',
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PREPARACION',
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "carrierName" TEXT NOT NULL,
    "carrierDoc" TEXT,
    "plannedAt" TIMESTAMP(3),
    "departedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "noticeRef" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShipmentItem" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "grams" DECIMAL(10,2) NOT NULL,
    "ddjjSignedAt" TIMESTAMP(3),
    "ddjjNote" TEXT,
    "dispensationId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Shipment_code_key" ON "Shipment"("code");
CREATE INDEX "Shipment_status_plannedAt_idx" ON "Shipment"("status", "plannedAt");
CREATE UNIQUE INDEX "ShipmentItem_dispensationId_key" ON "ShipmentItem"("dispensationId");
CREATE INDEX "ShipmentItem_memberId_idx" ON "ShipmentItem"("memberId");
CREATE INDEX "ShipmentItem_batchId_idx" ON "ShipmentItem"("batchId");

ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_dispensationId_fkey" FOREIGN KEY ("dispensationId") REFERENCES "Dispensation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Un aviso pertenece a un episodio: si el hecho cambia (otro vencimiento, otra reserva), vuelve a estar "sin avisar".
ALTER TABLE "NoticeLog" ADD COLUMN "episode" TEXT;
CREATE INDEX "NoticeLog_memberId_kind_episode_idx" ON "NoticeLog"("memberId", "kind", "episode");
