-- El domicilio se declara en la validación, no después.
--
-- El JEV sobre el padrón importado marcó 8 de 22 socios con domicilio insuficiente para despachar (sin localidad,
-- sin código postal, o «retiro en sucursal» sin aclarar). Ese dato se pide una sola vez, en el mismo trámite donde el
-- socio ya está escribiendo, y viaja al legajo recién cuando el club aprueba — igual que el DNI y el REPROCANN.

ALTER TABLE "Member"
  ADD COLUMN "locality"   TEXT,
  ADD COLUMN "province"   TEXT,
  ADD COLUMN "postalCode" TEXT;

ALTER TABLE "MemberVerification"
  ADD COLUMN "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'RETIRO',
  ADD COLUMN "address"      TEXT,
  ADD COLUMN "locality"     TEXT,
  ADD COLUMN "province"     TEXT,
  ADD COLUMN "postalCode"   TEXT;
