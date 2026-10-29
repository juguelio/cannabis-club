-- Foto del producto por variedad, para el catálogo del sitio y del portal.
ALTER TABLE "Strain" ADD COLUMN "fotoData" BYTEA;
ALTER TABLE "Strain" ADD COLUMN "fotoMime" TEXT;
ALTER TABLE "Strain" ADD COLUMN "fotoVersion" INTEGER NOT NULL DEFAULT 0;
