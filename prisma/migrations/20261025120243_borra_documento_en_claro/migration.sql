-- REA 4: una vez que todas las filas tienen huella, el número en claro deja de existir.
-- El club conserva la capacidad de verificar un documento (huella + últimos 4), no el documento.
ALTER TABLE "Member" DROP COLUMN "docNumber";
