import "server-only";
import { prisma } from "./db";
import { audit } from "./audit";
import { badRequest, conflict, notFound } from "./errors";
import { encryptDoc, decryptDoc, MAX_DOC_BYTES, sha256 } from "./docs-crypto";
import {
  analizarMonto,
  estadoDePago,
  esperadoDelPedido,
  puedeSubirComprobante,
  type EstadoPago,
} from "./comprobante-rules";
import { confirmPickup } from "./pickups";

/**
 * Comprobante del aporte: el socio transfiere y sube la foto; el club lo mira y decide.
 *
 * Nada acá cobra: no hay pasarela, no hay conciliación automática. El archivo cifrado es la prueba, la
 * aprobación es un acto del club y las dos cosas quedan auditadas.
 */

const PROOF_SELECT = {
  id: true,
  pickupId: true,
  montoArs: true,
  referencia: true,
  mime: true,
  size: true,
  sha256: true,
  status: true,
  motivo: true,
  reviewedAt: true,
  createdAt: true,
} as const;

export async function subirComprobante(input: {
  pickupId: string;
  memberId: string;
  actorId: string;
  monto: number | null;
  referencia?: string | null;
  mime: string;
  bytes: Buffer;
  ip?: string | null;
}) {
  if (!input.bytes.length) throw badRequest("ARCHIVO_VACIO", "El archivo llegó vacío.");
  if (input.bytes.length > MAX_DOC_BYTES) throw badRequest("ARCHIVO_GRANDE", "El archivo supera los 6 MB.");
  if (input.monto != null && (!Number.isFinite(input.monto) || input.monto <= 0))
    throw badRequest("MONTO_INVALIDO", "Poné el monto que transferiste, en pesos.");

  const pickup = await prisma.pickupRequest.findUnique({
    where: { id: input.pickupId },
    select: {
      id: true,
      memberId: true,
      status: true,
      grams: true,
      aporteEstimado: true,
      deliveryMode: true,
      deliveryCostoArs: true,
      paymentProofs: { select: { status: true, createdAt: true } },
    },
  });
  // Un socio no puede subir comprobantes de pedidos ajenos: se responde como si no existiera.
  if (!pickup || pickup.memberId !== input.memberId) throw notFound("Pedido inexistente");

  const estadoPago = estadoDePago(pickup.paymentProofs);
  const permiso = puedeSubirComprobante({ pickupStatus: pickup.status, estadoPago });
  if (!permiso.ok) throw conflict(permiso.codigo, permiso.mensaje);

  const { data, iv, tag } = encryptDoc(input.bytes);
  const huella = sha256(input.bytes);

  let proof;
  try {
    proof = await prisma.paymentProof.create({
      data: {
        pickupId: pickup.id,
        montoArs: input.monto,
        referencia: input.referencia?.slice(0, 80) ?? null,
        mime: input.mime,
        size: input.bytes.length,
        sha256: huella,
        iv,
        tag,
        data,
        uploadedById: input.actorId,
      },
      select: PROOF_SELECT,
    });
  } catch (err) {
    // El índice único parcial (un comprobante en revisión por pedido) corta la carrera de dos subidas.
    if ((err as { code?: string }).code === "P2002")
      throw conflict("COMPROBANTE_EN_REVISION", "Ya hay un comprobante en revisión: esperá la respuesta del club.");
    throw err;
  }

  const esperado = esperadoDelPedido({
    aporte: pickup.aporteEstimado,
    envio: pickup.deliveryCostoArs,
    modo: pickup.deliveryMode,
  });

  await audit({
    actorId: input.actorId,
    action: "PAYMENT_PROOF_UPLOAD",
    entity: "PaymentProof",
    entityId: proof.id,
    ip: input.ip ?? null,
    payload: {
      pickupId: pickup.id,
      monto: input.monto,
      size: proof.size,
      mime: proof.mime,
      sha256: huella,
      esperado: esperado.esperado,
      aporte: esperado.aporte,
      envio: esperado.envio,
    },
  });

  const analisis = analizarMonto({
    monto: input.monto,
    esperado: esperado.esperado,
  });

  return { comprobante: proof, ...analisis, esperadoDelPedido: esperado };
}

export async function decidirComprobante(input: {
  id: string;
  actorId: string;
  decision: "APROBAR" | "RECHAZAR";
  motivo?: string | null;
  ip?: string | null;
}) {
  const proof = await prisma.paymentProof.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      status: true,
      pickupId: true,
      montoArs: true,
      pickup: { select: { id: true, status: true, memberId: true, grams: true, aporteEstimado: true } },
    },
  });
  if (!proof) throw notFound("Comprobante inexistente");
  if (proof.status !== "EN_REVISION")
    throw conflict("COMPROBANTE_YA_RESUELTO", "Ese comprobante ya fue aprobado o rechazado.");

  const motivo = input.motivo?.trim() || null;
  // Rechazar sin decir por qué deja al socio subiendo la misma foto otra vez.
  if (input.decision === "RECHAZAR" && (!motivo || motivo.length < 5))
    throw badRequest("MOTIVO_REQUERIDO", "Contá por qué se rechaza: el socio lo va a leer.");

  const actualizado = await prisma.paymentProof.update({
    where: { id: proof.id },
    data: {
      status: input.decision === "APROBAR" ? "APROBADO" : "RECHAZADO",
      reviewedById: input.actorId,
      reviewedAt: new Date(),
      motivo: input.decision === "RECHAZAR" ? motivo : null,
    },
    select: PROOF_SELECT,
  });

  await audit({
    actorId: input.actorId,
    action: input.decision === "APROBAR" ? "PAYMENT_PROOF_APPROVE" : "PAYMENT_PROOF_REJECT",
    entity: "PaymentProof",
    entityId: proof.id,
    ip: input.ip ?? null,
    payload: { pickupId: proof.pickupId, monto: proof.montoArs ? Number(proof.montoArs) : null, motivo },
  });

  // Aprobar el comprobante confirma el pedido: es la misma transición de siempre, sin inventar otra.
  let confirmado = false;
  if (input.decision === "APROBAR" && proof.pickup.status === "SOLICITADA") {
    try {
      await confirmPickup({ id: proof.pickupId, actorId: input.actorId });
      confirmado = true;
    } catch (err) {
      if ((err as { code?: string }).code !== "PICKUP_NOT_PENDING") throw err;
    }
  }

  return { comprobante: actualizado, confirmado };
}

/** La cola del club: comprobantes esperando decisión, con lo que hace falta para decidir. */
export async function comprobantesEnRevision() {
  const proofs = await prisma.paymentProof.findMany({
    where: { status: "EN_REVISION" },
    orderBy: { createdAt: "asc" },
    select: {
      ...PROOF_SELECT,
      pickup: {
        select: {
          id: true,
          grams: true,
          status: true,
          deliveryMode: true,
          aporteEstimado: true,
          deliveryCostoArs: true,
          deliveryZona: true,
          deliveryAddress: true,
          appointment: { select: { scheduledAt: true } },
          member: { select: { id: true, legajo: true, firstName: true, lastName: true, email: true, phone: true } },
        },
      },
    },
  });

  return proofs.map((p) => {
    const esperado = esperadoDelPedido({
      aporte: p.pickup.aporteEstimado,
      envio: p.pickup.deliveryCostoArs,
      modo: p.pickup.deliveryMode,
    });
    const monto = p.montoArs ? Number(p.montoArs) : null;
    return {
      ...p,
      montoArs: monto,
      pickup: {
        ...p.pickup,
        grams: Number(p.pickup.grams),
        aporteEstimado: p.pickup.aporteEstimado ? Number(p.pickup.aporteEstimado) : null,
        deliveryCostoArs: p.pickup.deliveryCostoArs ? Number(p.pickup.deliveryCostoArs) : null,
      },
      // El desglose va con el número: la cola mostraba «declaró $224 de $199» sobre un pago perfecto.
      esperado,
      analisis: analizarMonto({ monto, esperado: esperado.esperado }),
    };
  });
}

/** Abre un comprobante para verlo: descifra en memoria y deja el asiento de que alguien lo miró. */
export async function comprobanteParaVer(input: { id: string; actorId: string; ip?: string | null }) {
  const proof = await prisma.paymentProof.findUnique({
    where: { id: input.id },
    select: { id: true, mime: true, iv: true, tag: true, data: true, pickupId: true },
  });
  if (!proof) throw notFound("Comprobante inexistente");

  await audit({
    actorId: input.actorId,
    action: "PAYMENT_PROOF_VIEW",
    entity: "PaymentProof",
    entityId: proof.id,
    ip: input.ip ?? null,
    payload: { pickupId: proof.pickupId, mime: proof.mime },
  });

  return { mime: proof.mime, bytes: decryptDoc(proof) };
}

/** Estado de pago de los pedidos de un socio, para mostrarlo en el portal sin traer los archivos. */
export async function estadosDePagoPorPedido(pickupIds: string[]): Promise<Map<string, EstadoPago>> {
  if (!pickupIds.length) return new Map();
  const proofs = await prisma.paymentProof.findMany({
    where: { pickupId: { in: pickupIds } },
    select: { pickupId: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const porPedido = new Map<string, { status: "EN_REVISION" | "APROBADO" | "RECHAZADO"; createdAt: Date }[]>();
  for (const p of proofs) {
    const lista = porPedido.get(p.pickupId) ?? [];
    lista.push({ status: p.status, createdAt: p.createdAt });
    porPedido.set(p.pickupId, lista);
  }
  return new Map([...porPedido.entries()].map(([id, lista]) => [id, estadoDePago(lista)]));
}
