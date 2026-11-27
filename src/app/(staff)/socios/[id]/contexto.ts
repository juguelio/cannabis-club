import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const contextoLegajo = cache(async (id: string) => {
  const session = await getSession();
  if (!session) redirect("/login");
  const member = await prisma.member.findUnique({ where: { id }, select: {
    archivos: { where: { tipo: "PERFIL" }, select: { uploadedAt: true } },
    id: true, legajo: true, firstName: true, lastName: true, birthDate: true, docLast4: true,
    status: true, statusReason: true, verificationStatus: true, reprocannStatus: true,
    reprocannExpiresAt: true, consumptionType: true, consentSignedAt: true, monthlyForecastG: true,
  } });
  if (!member) notFound();
  return { session, member };
});
