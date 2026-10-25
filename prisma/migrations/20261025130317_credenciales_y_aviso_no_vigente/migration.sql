-- Ciclo de vida de la credencial: la clave temporal vence y restablecerla invalida sesiones.
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- Un aviso no vigente no es un vencimiento: EN_TRAMITE o RECHAZADO no se anuncian como "vencido".
ALTER TYPE "NoticeKind" ADD VALUE 'REPROCANN_NO_VIGENTE';
