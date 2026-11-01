-- Envío del producto al domicilio del socio.
--
-- Hasta acá toda reserva era un retiro: el socio venía al club con turno. Un envío no ocupa
-- turno (nadie viene), viaja a la dirección que declaró y lleva el costo de la zona del club.
-- La dirección se copia en la reserva porque el envío tiene que conservar la que se usó.

CREATE TYPE "DeliveryMode" AS ENUM ('RETIRO', 'ENVIO');

ALTER TABLE "PickupRequest"
  ADD COLUMN "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'RETIRO',
  ADD COLUMN "deliveryAddress" TEXT,
  ADD COLUMN "deliveryZona" TEXT,
  ADD COLUMN "deliveryDemora" TEXT,
  ADD COLUMN "deliveryTransportista" TEXT,
  ADD COLUMN "deliveryCostoArs" DECIMAL(10, 2);

-- El ítem del envío apunta al pedido del portal que cierra: entregarlo lo pasa a RETIRADA.
ALTER TABLE "ShipmentItem" ADD COLUMN "pickupRequestId" TEXT;
CREATE UNIQUE INDEX "ShipmentItem_pickupRequestId_key" ON "ShipmentItem"("pickupRequestId");
ALTER TABLE "ShipmentItem"
  ADD CONSTRAINT "ShipmentItem_pickupRequestId_fkey"
  FOREIGN KEY ("pickupRequestId") REFERENCES "PickupRequest"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
