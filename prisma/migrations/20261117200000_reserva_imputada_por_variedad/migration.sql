-- La reserva se imputa variedad por variedad: cada ítem reservado apunta a la entrega que lo cubrió.
-- Aditiva y nullable: las reservas viejas y la entrega del total siguen funcionando igual.
ALTER TABLE "PickupItem" ADD COLUMN "dispensationId" TEXT;

CREATE UNIQUE INDEX "PickupItem_dispensationId_key" ON "PickupItem"("dispensationId");

ALTER TABLE "PickupItem" ADD CONSTRAINT "PickupItem_dispensationId_fkey"
  FOREIGN KEY ("dispensationId") REFERENCES "Dispensation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
