import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DIAS_RETENCION_RECHAZO, corteRetencion } from "@/lib/retention-rules";

/** Borra los archivos de las solicitudes rechazadas hace más de 30 días. */
export async function purgarDocumentosRechazadas(hoy = new Date()) {
  const rechazadas = await prisma.accessRequest.findMany({
    where: { status: "RECHAZADA", reviewedAt: { not: null, lte: corteRetencion(hoy) } },
    select: { id: true, documents: { select: { id: true } } },
  });

  const conArchivos = rechazadas.filter((r) => r.documents.length > 0);
  if (conArchivos.length === 0) return { solicitudes: 0, archivos: 0 };

  const ids = conArchivos.flatMap((r) => r.documents.map((d) => d.id));
  const borrados = await prisma.accessDocument.deleteMany({ where: { id: { in: ids } } });

  await audit({
    actorId: null,
    action: "ACCESS_DOC_RETENTION",
    entity: "AccessDocument",
    payload: {
      solicitudes: conArchivos.length,
      archivos: borrados.count,
      dias: DIAS_RETENCION_RECHAZO,
      detalle: conArchivos.map((r) => ({ solicitud: r.id, archivos: r.documents.length })),
    },
  });

  return { solicitudes: conArchivos.length, archivos: borrados.count };
}
