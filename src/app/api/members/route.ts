import { calendarDate, optionalDate } from "@/lib/validation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { clientIp, fail, json } from "@/lib/http";
import { conflict } from "@/lib/errors";

const CreateBody = z.object({
  firstName: z.string().trim().min(2),
  lastName: z.string().trim().min(2),
  docType: z.string().default("DNI"),
  docNumber: z.string().trim().min(6),
  birthDate: calendarDate.refine(v => new Date(v) <= new Date(), "El nacimiento no puede estar en el futuro"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  reprocannNumber: z.string().optional(),
  reprocannStatus: z.enum(["NO_APORTA", "EN_TRAMITE", "VIGENTE", "VENCIDO", "RECHAZADO"]).default("NO_APORTA"),
  reprocannExpiresAt: optionalDate.optional(),
  consumptionType: z.enum(["LUDICO", "TERAPEUTICO"]).default("LUDICO"),
  monthlyForecastG: z.number().nonnegative().optional(),
  consentSignedAt: optionalDate.optional(),
  notes: z.string().optional(),
  status: z.enum(["PENDIENTE", "ACTIVO", "SUSPENDIDO", "BAJA"]).default("PENDIENTE"),
});

export async function GET(req: Request) {
  try {
    await requireUser();
    const status = z.enum(["ACTIVO", "PENDIENTE", "SUSPENDIDO", "BAJA"]).optional().parse(new URL(req.url).searchParams.get("status") || undefined);
    const q = new URL(req.url).searchParams.get("q")?.trim();
    const members = await prisma.member.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { docNumber: { contains: q } },
                { reprocannNumber: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 200,
    });
    return json({ members });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(["ADMIN", "OPERADOR"]);
    const body = CreateBody.parse(await req.json());

    const existing = await prisma.member.findUnique({ where: { docNumber: body.docNumber } });
    if (existing) throw conflict("DOC_EXISTS", `Ya existe un socio con documento ${body.docNumber}.`);

    const member = await prisma.$transaction(async tx => {
      const last = await tx.member.aggregate({ _max: { legajo: true } });
      const legajo = (last._max.legajo ?? 0) + 1;

      const member = await tx.member.create({
        data: {
          legajo,
          firstName: body.firstName,
          lastName: body.lastName,
          docType: body.docType,
          docNumber: body.docNumber,
          birthDate: new Date(`${body.birthDate}T00:00:00.000Z`),
          address: body.address || null,
          phone: body.phone || null,
          email: body.email || null,
          reprocannNumber: body.reprocannNumber || null,
          reprocannStatus: body.reprocannStatus,
          reprocannExpiresAt: body.reprocannExpiresAt ? new Date(`${body.reprocannExpiresAt}T00:00:00.000Z`) : null,
          consumptionType: body.consumptionType,
          monthlyForecastG: body.monthlyForecastG == null ? null : body.monthlyForecastG,
          consentSignedAt: body.consentSignedAt ? new Date(`${body.consentSignedAt}T00:00:00.000Z`) : null,
          notes: body.notes || null,
          status: body.status,
          admittedAt: body.status === "ACTIVO" ? new Date() : null,
        },
      });

      await tx.auditLog.create({ data: { actorId: user.id, action: "MEMBER_CREATE", entity: "Member", entityId: member.id, ip: clientIp(req), payload: { legajo } } });
      return member;
    }, { isolationLevel: "Serializable" });
    return json({ member }, 201);
  } catch (error) {
    return fail(error);
  }
}
