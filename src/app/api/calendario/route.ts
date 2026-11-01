import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { json, fail } from "@/lib/http";
import { rangeBoard } from "@/lib/appointments-db";
import { addDaysKey } from "@/lib/appointments";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 42;

const Query = z.object({ desde: z.string().regex(DAY), hasta: z.string().regex(DAY) });

/**
 * Grilla del calendario: resumen y turnos de cada día del rango. El rango se acota acá (42 días,
 * el mes más largo con sus semanas completas) para que no se pueda pedir un año entero.
 */
export async function GET(req: Request) {
  try {
    await requireUser(["ADMIN", "OPERADOR", "DISPENSADOR"]);
    const url = new URL(req.url);
    const q = Query.parse({ desde: url.searchParams.get("desde") ?? "", hasta: url.searchParams.get("hasta") ?? "" });
    const dias = Math.round((new Date(`${q.hasta}T00:00:00Z`).getTime() - new Date(`${q.desde}T00:00:00Z`).getTime()) / 86_400_000) + 1;
    if (dias < 1 || dias > MAX_DIAS) {
      return json({ error: "RANGO_INVALIDO", message: `El rango tiene que ser de 1 a ${MAX_DIAS} días.` }, 400);
    }
    const board = await rangeBoard(q.desde, q.hasta);
    return json({ desde: q.desde, hasta: q.hasta, siguiente: addDaysKey(q.hasta, 1), dias: board });
  } catch (error) {
    return fail(error);
  }
}
