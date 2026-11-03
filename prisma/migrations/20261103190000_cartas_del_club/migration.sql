-- La carta del club como objeto propio: contenido aprobado, quién lo aprobó y cuándo sale.
--
-- Se escribe a mano porque `migrate dev` no puede levantar la base sombra con el historial actual,
-- y esta migración es puramente aditiva: un tipo nuevo, un valor nuevo en NoticeKind y una tabla.

-- CreateEnum
CREATE TYPE "EstadoCarta" AS ENUM ('BORRADOR', 'APROBADA', 'ENVIANDO', 'ENVIADA', 'CANCELADA');

-- AlterEnum
ALTER TYPE "NoticeKind" ADD VALUE 'CARTA_CLUB';

-- CreateTable
CREATE TABLE "EdicionCarta" (
    "id" TEXT NOT NULL,
    "edicion" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "copete" TEXT NOT NULL,
    "apertura" JSONB NOT NULL,
    "bloques" JSONB NOT NULL,
    "cta" JSONB,
    "estado" "EstadoCarta" NOT NULL DEFAULT 'BORRADOR',
    "programadaPara" TIMESTAMP(3),
    "enviadaEn" TIMESTAMP(3),
    "creadaPorId" TEXT,
    "aprobadaPorId" TEXT,
    "aprobadaEn" TIMESTAMP(3),
    "alcanzados" INTEGER NOT NULL DEFAULT 0,
    "enviados" INTEGER NOT NULL DEFAULT 0,
    "errores" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EdicionCarta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EdicionCarta_estado_programadaPara_idx" ON "EdicionCarta"("estado", "programadaPara");

-- CreateIndex
CREATE INDEX "EdicionCarta_createdAt_idx" ON "EdicionCarta"("createdAt");

-- AddForeignKey
ALTER TABLE "EdicionCarta" ADD CONSTRAINT "EdicionCarta_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdicionCarta" ADD CONSTRAINT "EdicionCarta_aprobadaPorId_fkey" FOREIGN KEY ("aprobadaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
