-- Clave de idempotencia de la entrega: reintentar la misma intención no duplica el asiento.
ALTER TABLE "Dispensation" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "Dispensation_idempotencyKey_key" ON "Dispensation"("idempotencyKey");
