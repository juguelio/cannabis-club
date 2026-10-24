import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { notFound } from "@/lib/errors";
import { getClub, limitsFromClub } from "@/lib/club";
import { memberUsage } from "@/lib/dispensary";
import { daysToExpiry, MEMBER_STATUS, REPROCANN_STATUS } from "@/lib/labels";

/** Estado de habilitación de un socio, para pintar el panel antes de entregar. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const [member, club] = await Promise.all([
      prisma.member.findUnique({ where: { id } }),
      getClub(),
    ]);
    if (!member) throw notFound("Socio inexistente");

    const usage = await memberUsage(prisma, member.id, club.timezone);
    const limits = limitsFromClub(club);
    const reprocannDays = daysToExpiry(member.reprocannExpiresAt);
    const isMinor = (() => {
      const b = member.birthDate;
      const now = new Date();
      let a = now.getUTCFullYear() - b.getUTCFullYear();
      if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) a -= 1;
      return a < limits.edadLimiteMenor;
    })();

    return json({
      member: {
        id: member.id,
        legajo: member.legajo,
        name: `${member.lastName}, ${member.firstName}`,
        docNumber: member.docNumber,
        status: member.status,
        statusLabel: MEMBER_STATUS[member.status]?.label ?? member.status,
        reprocannStatus: member.reprocannStatus,
        reprocannLabel: REPROCANN_STATUS[member.reprocannStatus]?.label ?? member.reprocannStatus,
        reprocannNumber: member.reprocannNumber,
        reprocannExpiresAt: member.reprocannExpiresAt,
        reprocannDays,
        forecastG: member.monthlyForecastG == null ? null : Number(member.monthlyForecastG),
      },
      usage,
      limits: {
        dailyG: limits.limiteDiarioG,
        monthlyG: isMinor ? Math.min(limits.limiteMenorG, limits.limiteMensualG) : limits.limiteMensualG,
        thcMaxPct: isMinor ? limits.thcMaxMenor : null,
        isMinor,
        requiresReprocann: limits.requiereReprocann,
      },
      blockers: [
        ...(member.status !== "ACTIVO" ? [`Estado ${MEMBER_STATUS[member.status]?.label ?? member.status}`] : []),
        ...(limits.requiereReprocann && member.reprocannStatus !== "VIGENTE"
          ? [REPROCANN_STATUS[member.reprocannStatus]?.label ?? "REPROCANN no vigente"]
          : []),
        ...(limits.requiereReprocann && reprocannDays !== null && reprocannDays < 0 ? ["REPROCANN vencido por fecha"] : []),
      ],
    });
  } catch (error) {
    return fail(error);
  }
}
