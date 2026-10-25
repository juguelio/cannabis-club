-- Marca configurable por club. Aditiva: columnas nuevas, todas opcionales o con default.
ALTER TABLE "Club" ADD COLUMN "marca" JSONB;
ALTER TABLE "Club" ADD COLUMN "marcaLogo" TEXT;
ALTER TABLE "Club" ADD COLUMN "marcaEmblema" TEXT;
ALTER TABLE "Club" ADD COLUMN "marcaPortada" TEXT;
ALTER TABLE "Club" ADD COLUMN "marcaVersion" INTEGER NOT NULL DEFAULT 0;
