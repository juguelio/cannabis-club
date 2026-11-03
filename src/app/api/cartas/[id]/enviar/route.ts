import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/http";
import { conflict, notFound } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { enviarCarta } from "@/lib/cartas";
import { puedeEnviarse } from "@/lib/cartas-rules";

/**
 * Enviar ahora una carta ya aprobada, sin esperar al cron.
 *
 * Sirve para cuando el club la aprobó y no quiere esperar la pasada de la madrugada. El envío es el
 * mismo: candado por socio en `NoticeLog`, tope por corrida y la posibilidad de retomar después.
 */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const staff = await requireUser(["ADMIN"]);
  const carta = await prisma.edicionCarta.findUnique({ where: { id }, select: { estado: true, edicion: true } });
  if (!carta) throw notFound("Esa carta no existe.");
  if (!puedeEnviarse(carta.estado)) {
    // El motivo importa: no es lo mismo «falta la firma» que «ya salió».
    throw conflict(
      carta.estado === "ENVIADA" ? "YA_ENVIADA" : "NO_APROBADA",
      carta.estado === "ENVIADA"
        ? "Esta carta ya se envió: no se manda dos veces. Para corregir algo, escribí una edición nueva."
        : carta.estado === "CANCELADA"
          ? "La carta está cancelada."
          : "Primero hay que aprobarla: la carta no sale sin la firma del club."
    );
  }

  const resumen = await enviarCarta({ id, modo: "real", actorId: staff.id });
  await audit({ actorId: staff.id, action: "CARTA_ENVIO_MANUAL", entity: "EdicionCarta", entityId: id, ip: clientIp(req), payload: { enviados: resumen.enviados, quedan: resumen.quedan } });
  return {
    ...resumen,
    mensaje: !resumen.mailer
      ? "El correo saliente no está configurado: no se mandó nada."
      : resumen.quedan > 0
        ? `Salieron ${resumen.enviados} y quedan ${resumen.quedan}: el cron sigue con el resto.`
        : `Carta enviada a ${resumen.enviados} socios${resumen.errores ? `, con ${resumen.errores} errores` : ""}.`,
  };
});

export const maxDuration = 60;
