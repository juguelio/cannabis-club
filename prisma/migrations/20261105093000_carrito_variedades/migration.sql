-- Detalle del pedido: qué variedades y cuántos gramos de cada una.
-- No toca datos existentes: las reservas viejas quedan sin detalle (el club ya las preparó a mano).

CREATE TABLE "PickupItem" (
    "id" TEXT NOT NULL,
    "pickupId" TEXT NOT NULL,
    "strainId" TEXT NOT NULL,
    "strainName" TEXT NOT NULL,
    "grams" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PickupItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PickupItem_pickupId_strainId_key" ON "PickupItem"("pickupId", "strainId");
CREATE INDEX "PickupItem_pickupId_idx" ON "PickupItem"("pickupId");

ALTER TABLE "PickupItem" ADD CONSTRAINT "PickupItem_pickupId_fkey"
    FOREIGN KEY ("pickupId") REFERENCES "PickupRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PickupItem" ADD CONSTRAINT "PickupItem_strainId_fkey"
    FOREIGN KEY ("strainId") REFERENCES "Strain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
