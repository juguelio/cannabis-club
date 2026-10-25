import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";
import { setDdjj } from "@/lib/shipments";

const Body = z.object({ ddjjSigned: z.boolean(), note: z.string().trim().max(200).optional() });

/** Marca (o desmarca) la DDJJ firmada por ese paciente: sin ella el traslado no se despacha. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    await requireUser(["ADMIN", "OPERADOR"]);
    const { itemId } = await ctx.params;
    const body = Body.parse(await req.json());
    const item = await setDdjj({ itemId, signed: body.ddjjSigned, note: body.note ?? null });
    return json({ item });
  } catch (error) {
    return fail(error);
  }
}

/** Quita un paciente del traslado (sólo en preparación y sin entrega asociada). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    await requireUser(["ADMIN", "OPERADOR"]);
    const { itemId } = await ctx.params;
    const item = await prisma.shipmentItem.findUnique({ where: { id: itemId }, include: { shipment: true } });
    if (!item) throw notFound("Ítem inexistente");
    if (item.shipment.status !== "PREPARACION") throw conflict("SHIPMENT_LOCKED", "El traslado ya salió.");
    if (item.dispensationId) throw conflict("ITEM_HAS_DISPENSATION", "Ese ítem ya tiene una entrega registrada.");
    await prisma.shipmentItem.delete({ where: { id: itemId } });
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
