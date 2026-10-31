import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { z } from "zod";
import { cotizacionDeLista, type FuenteCotizacion } from "@/lib/cotizacion";
import { aportePorGramoDe, preciosDeClub } from "@/lib/precios";

const Body = z.object({ fuente: z.enum(["oficial", "blue", "bolsa", "manual"]), valor: z.number().positive().optional() });

/**
 * Trae la cotización del día y la guarda en `Club.precios`, recalculando el aporte por gramo.
 * `manual` guarda el valor que manda el club sin consultar a nadie.
 */
export const POST = route(async (req) => {
  const actor = await requireUser(["ADMIN"]);
  const input = await body(req, Body);

  let cotizacion;
  if (input.fuente === "manual") {
    if (!input.valor) throw badRequest("COTIZACION_INVALIDA", "Escribí el valor del dólar para guardarlo a mano.");
    cotizacion = { fuente: "manual" as FuenteCotizacion, valor: input.valor, actualizadaAt: new Date().toISOString() };
  } else {
    let filas: unknown = null;
    try {
      const res = await fetch("https://dolarapi.com/v1/dolares", { signal: AbortSignal.timeout(8000), cache: "no-store" });
      if (res.ok) filas = await res.json();
    } catch {
      filas = null;
    }
    cotizacion = cotizacionDeLista(filas, input.fuente);
    if (!(cotizacion.valor > 0)) {
      throw badRequest("COTIZACION_SIN_DATO", "No pudimos traer la cotización ahora. Cargala a mano y se guarda igual.");
    }
  }

  const club = await prisma.club.findUnique({ where: { id: "singleton" }, select: { precios: true, aportePorGramo: true } });
  const precios = { ...preciosDeClub(club ?? {}), cotizacion };
  const aporte = aportePorGramoDe(precios);

  await prisma.$transaction(async (tx) => {
    await tx.club.update({ where: { id: "singleton" }, data: { precios, aportePorGramo: aporte } });
    await tx.auditLog.create({
      data: {
        actorId: actor.id, action: "CLUB_UPDATE", entity: "Club", entityId: "singleton", ip: clientIp(req),
        payload: { cotizacion, aportePorGramo: aporte },
      },
    });
  });

  return { ok: true, cotizacion, aportePorGramo: aporte };
});
