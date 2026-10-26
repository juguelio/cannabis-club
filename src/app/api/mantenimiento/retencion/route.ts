import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { purgarDocumentosRechazadas } from "@/lib/retention";
import { DIAS_RETENCION_RECHAZO } from "@/lib/retention-rules";

/**
 * Purga de documentación de solicitudes rechazadas. Pensada para un cron diario
 * (o para apretar el botón a mano). Sólo ADMIN y deja asiento en `AuditLog`.
 */
export const POST = route(async () => {
  await requireUser(["ADMIN"]);
  const resultado = await purgarDocumentosRechazadas();
  return {
    ...resultado,
    dias: DIAS_RETENCION_RECHAZO,
    mensaje:
      resultado.archivos === 0
        ? "No había documentación para purgar."
        : `Se borraron ${resultado.archivos} archivos de ${resultado.solicitudes} solicitudes rechazadas.`,
  };
});
