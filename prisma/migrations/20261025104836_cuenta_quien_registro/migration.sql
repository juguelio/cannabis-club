-- Quién registró cada asiento de la cuenta del socio (auditoría).
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
