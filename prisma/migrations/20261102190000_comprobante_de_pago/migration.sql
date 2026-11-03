-- Comprobante de pago del aporte: lo sube el socio, lo aprueba el club.
-- No hay pasarela ni cobro automático: el archivo es la prueba y la decisión queda auditada.

CREATE TYPE "PaymentProofStatus" AS ENUM ('EN_REVISION', 'APROBADO', 'RECHAZADO');

CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL,
    "pickupId" TEXT NOT NULL,
    "montoArs" DECIMAL(12,2),
    "referencia" TEXT,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "iv" BYTEA NOT NULL,
    "tag" BYTEA NOT NULL,
    "data" BYTEA NOT NULL,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'EN_REVISION',
    "uploadedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

-- Un solo comprobante en revisión por pedido: si el club lo rechaza, el socio sube otro.
CREATE UNIQUE INDEX "PaymentProof_pickup_en_revision_key"
    ON "PaymentProof" ("pickupId") WHERE "status" = 'EN_REVISION';

CREATE INDEX "PaymentProof_pickupId_createdAt_idx" ON "PaymentProof" ("pickupId", "createdAt");
CREATE INDEX "PaymentProof_status_idx" ON "PaymentProof" ("status");

ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_pickupId_fkey"
    FOREIGN KEY ("pickupId") REFERENCES "PickupRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Datos para transferir (alias, CBU, titular, banco): configuración del club, no del código.
ALTER TABLE "Club" ADD COLUMN "cobro" JSONB;
