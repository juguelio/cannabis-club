import { route } from "@/lib/api";
import { esCron, NO_AUTORIZADO } from "@/lib/cron";
import { requireUser } from "@/lib/auth";
import { expireStale } from "@/lib/pickups";
import { HORAS_SIN_COMPROBANTE } from "@/lib/pedido-vencimiento";

/**
 * Vencimiento de pedidos: los que quedaron sin comprobante y las reservas que nadie vino a buscar.
 *
 * Corre por cron y también al abrir el dispensario (`listPickups`), así que un pedido caído nunca
 * bloquea un turno por más de una hora. Al vencer se libera el horario y queda asiento en la auditoría.
 */
export const GET = route(async (req) => {
  if (!esCron(req)) {
    return new Response(JSON.stringify(NO_AUTORIZADO), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const r = await expireStale();
  return { ...r, horasSinComprobante: HORAS_SIN_COMPROBANTE, origen: "cron" };
});

export const POST = route(async () => {
  await requireUser(["ADMIN"]);
  const r = await expireStale();
  return {
    ...r,
    horasSinComprobante: HORAS_SIN_COMPROBANTE,
    mensaje: r.vencidos === 0 ? "No había pedidos para vencer." : `Se vencieron ${r.vencidos} pedidos y se liberaron sus turnos.`,
  };
});
