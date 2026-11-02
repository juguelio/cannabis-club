-- Un aviso automático se reclama ANTES de mandarse, y el reclamo es el índice único por episodio.
--
-- Antes era: buscar si ya estaba avisado → mandar el correo → registrar. Dos corridas simultáneas (cron
-- + botón de un ADMIN) leían las dos "no avisado" y mandaban dos correos; y si el registro fallaba
-- después de que el proveedor aceptó, el reintento lo volvía a mandar. Ahora el primer proceso que
-- inserta gana; el segundo choca contra el índice y no manda nada.
--
-- Parcial a propósito: sólo aplica a avisos automáticos con episodio. Los avisos que registra una
-- persona desde la cola se pueden repetir (avisar dos veces el mismo motivo es legítimo).

CREATE UNIQUE INDEX "NoticeLog_automatico_episodio_key"
  ON "NoticeLog" ("memberId", "kind", "episode")
  WHERE "automatic" = true AND "episode" IS NOT NULL;
