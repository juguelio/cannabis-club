import "server-only";

import { prisma } from "@/lib/db";
import {
  agruparPorDestino,
  rangoPeriodo,
  totalesDestino,
  type DestinoResumen,
  type FilaEnvio,
  type Periodo,
  type Rango,
  type TotalesDestino,
} from "@/lib/envios-destino";

export type EnviosPorDestino = {
  rango: Rango;
  destinos: DestinoResumen[];
  totales: TotalesDestino;
};

/**
 * Envíos despachados en el período, agrupados por localidad del socio.
 *
 * Sólo cuenta lo que efectivamente salió (`fulfilledAt`): un pedido confirmado que todavía no
 * se despachó no es plata gastada en envío. El costo y el aporte son los congelados en el
 * pedido, no los precios de hoy.
 */
export async function enviosPorDestino(periodo: Periodo, ahora = new Date()): Promise<EnviosPorDestino> {
  const rango = rangoPeriodo(periodo, ahora);

  const pedidos = await prisma.pickupRequest.findMany({
    where: {
      deliveryMode: "ENVIO",
      fulfilledAt: { not: null, gte: rango.desde, lte: rango.hasta },
    },
    select: {
      grams: true,
      deliveryCostoArs: true,
      aporteEstimado: true,
      deliveryZona: true,
      member: { select: { locality: true } },
    },
  });

  const filas: FilaEnvio[] = pedidos.map((p) => ({
    localidad: p.member.locality,
    zona: p.deliveryZona,
    grams: Number(p.grams),
    costoEnvio: Number(p.deliveryCostoArs ?? 0),
    aporte: Number(p.aporteEstimado ?? 0),
  }));

  const destinos = agruparPorDestino(filas);
  return { rango, destinos, totales: totalesDestino(destinos) };
}
