-- Cierra el hueco que dejó el orden de las migraciones.
--
-- `20261102010000_domicilio_en_la_validacion` agrega cinco columnas a "MemberVerification", pero corre ANTES de
-- `20261102140000_revalidacion_dni_reprocann`, que es la que crea esa tabla. En producción la tabla ya existía, así
-- que el ALTER funcionó; en una base nueva la tabla no está y el bloque protegido la saltea.
--
-- Esta migración deja el esquema igual en las dos situaciones: si las columnas ya están (producción, staging viejo)
-- no hace nada; si faltan (base nueva, o cualquier base reconstruida desde cero) las agrega.
-- Es idempotente a propósito: `IF NOT EXISTS` en cada columna.

ALTER TABLE "MemberVerification"
  ADD COLUMN IF NOT EXISTS "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'RETIRO',
  ADD COLUMN IF NOT EXISTS "address"      TEXT,
  ADD COLUMN IF NOT EXISTS "locality"     TEXT,
  ADD COLUMN IF NOT EXISTS "province"     TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode"   TEXT;
