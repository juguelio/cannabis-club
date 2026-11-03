import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/http";
import { notFound } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { enviarCarta } from "@/lib/cartas";

/**
 * Mandar la edición a la casilla del club, tal como la va a ver el socio.
 *
 * No toca `NoticeLog` ni cambia el estado: es un ensayo. El link de baja que lleva está firmado
 * para un id que no existe, así que si alguien lo toca no da de baja a nadie real.
 */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const staff = await requireUser(["ADMIN"]);
  const carta = await prisma.edicionCarta.findUnique({ where: { id }, select: { id: true } });
  if (!carta) throw notFound("Esa carta no existe.");

  const resumen = await enviarCarta({ id, modo: "prueba", actorId: staff.id });
  await audit({ actorId: staff.id, action: "CARTA_PRUEBA", entity: "EdicionCarta", entityId: id, ip: clientIp(req), payload: { enviados: resumen.enviados, errores: resumen.errores } });
  return {
    ...resumen,
    mensaje: !resumen.mailer
      ? "El correo saliente no está configurado: no se mandó la prueba."
      : resumen.enviados === 1
        ? "Prueba enviada a la casilla del club."
        : `No se pudo enviar la prueba: ${resumen.detalle[0]?.motivo ?? "error del proveedor"}.`,
  };
});

export const maxDuration = 60;
