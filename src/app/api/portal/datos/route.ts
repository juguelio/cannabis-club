import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/http";
import { prisma } from "@/lib/db";
import { cambios, faltaParaEnvio, normalizarDatosOperativos, type DatosOperativos } from "@/lib/mis-datos";
import { badRequest } from "@/lib/errors";

/**
 * El socio corrige su domicilio, su código postal y su teléfono sin pasar por la secretaría.
 *
 * Lo que NO se edita acá es la identidad —nombre, DNI, número y vencimiento del REPROCANN—: eso lo
 * valida el club contra el documento y la credencial, y si el socio pudiera cambiarlo la verificación
 * no querría decir nada.
 *
 * Tocar el domicilio no invalida la verificación y queda auditado con el antes y el después: es el
 * dato con el que sale un paquete.
 */
const Body = z.object({
  address: z.string().max(160).optional(),
  locality: z.string().max(80).optional(),
  province: z.string().max(80).optional(),
  postalCode: z.string().max(12).optional(),
  phone: z.string().max(40).optional(),
});

export const PATCH = route(async (req) => {
  const socio = await requireMember();
  const input = await body(req, Body);

  const normalizado = normalizarDatosOperativos(input);
  if (!normalizado.ok) {
    const primero = normalizado.problemas[0];
    throw badRequest("DATOS_INVALIDOS", primero.mensaje, { campos: normalizado.problemas });
  }

  const antes = await prisma.member.findUniqueOrThrow({
    where: { id: socio.memberId },
    select: { address: true, locality: true, province: true, postalCode: true, phone: true },
  });

  const diferencia = cambios<DatosOperativos>(antes, normalizado.datos);

  if (Object.keys(diferencia).length) {
    await prisma.member.update({ where: { id: socio.memberId }, data: normalizado.datos });
    await audit({
      actorId: socio.id,
      action: "DATOS_SOCIO_ACTUALIZADOS",
      entity: "Member",
      entityId: socio.memberId,
      ip: clientIp(req),
      payload: { antes, despues: diferencia, origen: "portal_del_socio" },
    });
  }

  return {
    datos: { ...antes, ...normalizado.datos },
    faltaParaEnvio: faltaParaEnvio(normalizado.datos),
    mensaje: Object.keys(diferencia).length ? "Listo: guardamos tus datos." : "No había nada para cambiar.",
  };
});

export const GET = route(async () => {
  const socio = await requireMember();
  const datos = await prisma.member.findUniqueOrThrow({
    where: { id: socio.memberId },
    select: { address: true, locality: true, province: true, postalCode: true, phone: true },
  });
  return { datos, faltaParaEnvio: faltaParaEnvio(datos) };
});
