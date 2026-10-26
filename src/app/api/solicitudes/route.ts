import { prisma } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { DOC_TIPOS } from "@/lib/docs-crypto";

/** Cola de solicitudes para el club: datos declarados, archivos y estado. */
export const GET = route(async (req) => {
  await requireUser(["ADMIN"]);
  const status = new URL(req.url).searchParams.get("status");
  const estados = status === "todas" ? undefined : (status ?? "PENDIENTE").toUpperCase();

  const solicitudes = await prisma.accessRequest.findMany({
    where: estados ? { status: estados as "PENDIENTE" | "APROBADA" | "RECHAZADA" } : {},
    orderBy: { submittedAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      phone: true,
      address: true,
      locality: true,
      docLast4: true,
      reprocannNumber: true,
      reprocannExpiresAt: true,
      consumptionType: true,
      submittedAt: true,
      reviewedAt: true,
      rejectionReason: true,
      memberId: true,
      user: { select: { email: true, createdAt: true } },
      documents: { select: { id: true, tipo: true, mime: true, size: true, uploadedAt: true } },
      member: { select: { legajo: true } },
    },
  });

  return {
    solicitudes: solicitudes.map((s) => ({
      ...s,
      faltantes: DOC_TIPOS.filter((t) => !s.documents.some((d) => d.tipo === t)),
    })),
  };
});
