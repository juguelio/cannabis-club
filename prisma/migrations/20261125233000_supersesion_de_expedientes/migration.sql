-- Un reenvío del socio dejaba de reescribir el expediente anterior, pero reescribía su decisión.
--
-- Hasta acá, presentar de nuevo marcaba el expediente anterior `RECHAZADO` con motivo fijo
-- «Reemplazada por una presentación nueva del socio.» y `reviewedAt` de ese momento, sin tocar
-- `reviewedById`: el motivo que había escrito el club se perdía y la fila quedaba como un rechazo del
-- club con un texto que el club no eligió (y con la hora del reenvío, no de la decisión).
--
-- La decisión se conserva: el expediente anterior no se edita. Lo único que se agrega es cuándo quedó
-- supersedido por una presentación posterior, que es lo que lo saca de la cola de revisión.
--
-- Aditiva y nullable: las filas que ya existen quedan en NULL, que es «nadie la reemplazó».

ALTER TABLE "MemberVerification" ADD COLUMN IF NOT EXISTS "supersededAt" TIMESTAMP(3);
