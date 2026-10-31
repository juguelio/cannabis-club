import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { z } from "zod";
import { esCron, NO_AUTORIZADO } from "@/lib/cron";
import { traerCotizacion } from "@/lib/cotizacion-server";
import { aportePorGramoDe, preciosDeClub } from "@/lib/precios";
import type { Cotizacion } from "@/lib/cotizacion";

const Body = z.object({ fuente: z.enum(["oficial", "blue", "bolsa", "manual"]), valor: z.number().positive().optional() });

/** Guarda la cotización y recalcula el aporte por gramo que usa la cuenta corriente. */
async function guardar(cotizacion: Cotizacion, actorId: string | null, ip: string | null) {
  const club = await prisma.club.findUnique({ where: { id: "singleton" }, select: { precios: true } });
  const precios = { ...preciosDeClub(club ?? {}), cotizacion };
  const aporte = aportePorGramoDe(precios);

  await prisma.$transaction(async (tx) => {
    await tx.club.update({ where: { id: "singleton" }, data: { precios, aportePorGramo: aporte } });
    await tx.auditLog.create({
      data: {
        actorId, action: "CLUB_UPDATE", entity: "Club", entityId: "singleton", ip,
        payload: { cotizacion, aportePorGramo: aporte, origen: actorId ? "pantalla" : "cron" },
      },
    });
  });
  return { ok: true, cotizacion, aportePorGramo: aporte };
}

/** Cron diario: refresca con la fuente que el club ya eligió. La carga a mano no se toca. */
export const GET = route(async (req) => {
  if (!esCron(req)) {
    return new Response(JSON.stringify(NO_AUTORIZADO), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const club = await prisma.club.findUnique({ where: { id: "singleton" }, select: { precios: true } });
  const precios = preciosDeClub(club ?? {});
  const actual = precios.cotizacion;
  if (precios.moneda !== "USD") {
    // Cobrando en pesos la cotización no se usa: no se escribe nada ni se ensucia la auditoría todos los días.
    return { ok: true, saltado: "El club cobra en pesos: la cotización no cambia nada.", cotizacion: actual };
  }
  if (actual.fuente === "manual") {
    return { ok: true, saltado: "La cotización está cargada a mano: el cron no la toca.", cotizacion: actual };
  }
  const nueva = await traerCotizacion(actual.fuente);
  if (!(nueva.valor > 0)) return { ok: false, error: "COTIZACION_SIN_DATO", cotizacion: actual };
  return guardar(nueva, null, null);
});

/**
 * Trae la cotización del día y la guarda en `Club.precios`, recalculando el aporte por gramo.
 * `manual` guarda el valor que manda el club sin consultar a nadie.
 */
export const POST = route(async (req) => {
  const actor = await requireUser(["ADMIN"]);
  const input = await body(req, Body);
  const cotizacion = await traerCotizacion(input.fuente, input.valor);
  if (!(cotizacion.valor > 0)) {
    throw badRequest("COTIZACION_SIN_DATO", "No pudimos traer la cotización ahora. Cargala a mano y se guarda igual.");
  }
  return guardar(cotizacion, actor.id, clientIp(req));
});
