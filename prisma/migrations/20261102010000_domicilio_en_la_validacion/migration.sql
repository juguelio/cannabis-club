-- El domicilio se declara en la validación, no después.
--
-- El JEV sobre el padrón importado marcó 8 de 22 socios con domicilio insuficiente para despachar (sin localidad,
-- sin código postal, o «retiro en sucursal» sin aclarar). Ese dato se pide una sola vez, en el mismo trámite donde el
-- socio ya está escribiendo, y viaja al legajo recién cuando el club aprueba — igual que el DNI y el REPROCANN.
--
-- OJO con el orden: esta migración es anterior a `20261102140000_revalidacion_dni_reprocann`, que es la que CREA
-- "MemberVerification". En una base nueva la tabla todavía no existe cuando corre este archivo, así que el ALTER va
-- protegido (y con IF NOT EXISTS) y las columnas de la verificación las agrega `20261118050000_domicilio_en_la_verificacion`.
-- En producción y en las bases ya migradas la tabla existe: el bloque hace exactamente lo mismo que antes.

ALTER TABLE "Member"
  ADD COLUMN IF NOT EXISTS "locality"   TEXT,
  ADD COLUMN IF NOT EXISTS "province"   TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT;

DO $$
BEGIN
  IF to_regclass('"MemberVerification"') IS NOT NULL THEN
    ALTER TABLE "MemberVerification"
      ADD COLUMN IF NOT EXISTS "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'RETIRO',
      ADD COLUMN IF NOT EXISTS "address"      TEXT,
      ADD COLUMN IF NOT EXISTS "locality"     TEXT,
      ADD COLUMN IF NOT EXISTS "province"     TEXT,
      ADD COLUMN IF NOT EXISTS "postalCode"   TEXT;
  END IF;
END $$;
