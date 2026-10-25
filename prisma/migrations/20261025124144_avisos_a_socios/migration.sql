-- REA 5: avisos a socios (append-only) para vencimientos y regularizaciones.
CREATE TYPE "NoticeKind" AS ENUM (
  'REPROCANN_VENCIDO', 'REPROCANN_POR_VENCER', 'REPROCANN_SIN_FECHA',
  'CONSENTIMIENTO_FALTANTE', 'RESERVA_SIN_RETIRAR', 'CUENTA_CON_SALDO', 'DOCUMENTO_SIN_VERIFICAR'
);
CREATE TYPE "NoticeChannel" AS ENUM ('WHATSAPP', 'LLAMADO', 'PRESENCIAL', 'EMAIL');

CREATE TABLE "NoticeLog" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "kind" "NoticeKind" NOT NULL,
  "channel" "NoticeChannel" NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "byId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NoticeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NoticeLog_memberId_kind_sentAt_idx" ON "NoticeLog"("memberId", "kind", "sentAt");
CREATE INDEX "NoticeLog_sentAt_idx" ON "NoticeLog"("sentAt");

ALTER TABLE "NoticeLog" ADD CONSTRAINT "NoticeLog_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoticeLog" ADD CONSTRAINT "NoticeLog_byId_fkey"
  FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
