import { route } from "@/lib/api";
import { esCron, NO_AUTORIZADO } from "@/lib/cron";
import { requireUser } from "@/lib/auth";
import { purgarDocumentosRechazadas } from "@/lib/retention";
import { DIAS_RETENCION_RECHAZO } from "@/lib/retention-rules";
import { expireStale } from "@/lib/pickups";

/**
 * Purga de documentación de solicitudes rechazadas. Pensada para un cron diario
 * (o para apretar el botón a mano). Sólo ADMIN y deja asiento en `AuditLog`.
 */
/** Cron diario: llega sin sesión, con `Authorization: Bearer $CRON_SECRET`. */
export const GET = route(async (req) => {
  if (!esCron(req)) {
    return new Response(JSON.stringify(NO_AUTORIZADO), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const resultado = await purgarDocumentosRechazadas();
  // Las pantallas vencen reservas como mucho cada 5 minutos por instancia; el cron diario lo garantiza.
  await expireStale({ force: true });
  return { ...resultado, dias: DIAS_RETENCION_RECHAZO, origen: "cron" };
});

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
