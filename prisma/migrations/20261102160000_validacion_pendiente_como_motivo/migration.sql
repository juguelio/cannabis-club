-- Un legajo sin validar no tiene REPROCANN ni consentimiento que reclamar: tiene un trámite sin hacer.
-- Sin este motivo propio, la cola de avisos mostraba tres avisos por socio (REPROCANN no vigente, sin
-- fecha y consentimiento) sobre datos que todavía no existen: 22 socios importados tapaban los avisos
-- reales del club.
ALTER TYPE "NoticeKind" ADD VALUE IF NOT EXISTS 'VALIDACION_PENDIENTE';
