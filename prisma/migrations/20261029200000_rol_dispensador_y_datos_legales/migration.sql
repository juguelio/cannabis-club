-- Rol de mostrador: registra entregas sin poder aprobar altas ni tocar configuración.
ALTER TYPE "Role" ADD VALUE 'DISPENSADOR';

-- Datos legales que pide el informe semestral y la Res. 1780/2025.
ALTER TABLE "Club" ADD COLUMN "directorMedicoMatricula" TEXT;
ALTER TABLE "Club" ADD COLUMN "responsableTecnicoTitulo" TEXT;
ALTER TABLE "Club" ADD COLUMN "personeria" TEXT;
ALTER TABLE "Club" ADD COLUMN "reps" TEXT;
ALTER TABLE "Club" ADD COLUMN "domicilioLegal" TEXT;
