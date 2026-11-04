-- Pregunta única del onboarding: ¿tenés REPROCANN?
--
-- Nulo = todavía no le preguntamos. Verificado y con la guía vista, el socio puede corregir la
-- respuesta desde el portal, así que esto no es un estado intocable: es lo último que dijo.
CREATE TYPE "ReprocannDeclaracion" AS ENUM ('TIENE', 'NO_TIENE');

ALTER TABLE "Member"
  ADD COLUMN "reprocannDeclaracion" "ReprocannDeclaracion",
  ADD COLUMN "reprocannAskedAt" timestamp(3);
