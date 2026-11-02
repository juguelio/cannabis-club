-- Aviso automático de vencimiento del REPROCANN.
--
-- La cola de /avisos ya calculaba «por vencer», pero sólo cuando alguien abría la pantalla: si el
-- club no entraba esa semana, el socio se enteraba cuando no podía retirar. El trabajo diario
-- manda el email y deja el asiento. Un aviso automático no tiene persona detrás, y el registro
-- tiene que poder decirlo: por eso `byId` pasa a nullable y se agrega `automatic`.

ALTER TABLE "NoticeLog" ALTER COLUMN "byId" DROP NOT NULL;
ALTER TABLE "NoticeLog" ADD COLUMN "automatic" BOOLEAN NOT NULL DEFAULT false;

-- El umbral es configuración del club, no una constante: 30 días por defecto.
ALTER TABLE "Club" ADD COLUMN "avisoReprocannDias" INTEGER NOT NULL DEFAULT 30;
