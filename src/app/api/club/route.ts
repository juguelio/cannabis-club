
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getClub, CLUB_ID, OMIT_IMAGES } from "@/lib/club";
import { clubSettings, clubSettingsFields } from "@/lib/club-settings";
import { clientIp, fail, json } from "@/lib/http";

const Body = clubSettingsFields.partial();

export async function GET() {
  try {
    await requireUser();
    const club = await getClub();
    return json({ club });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser(["ADMIN"]);
    const body = Body.parse(await req.json());
    await getClub();
    const club = await prisma.$transaction(async tx => {
      const current = await tx.club.findUniqueOrThrow({ where: { id: CLUB_ID }, omit: OMIT_IMAGES });
      clubSettings.parse({ ...current,
        limiteDiarioG: Number(current.limiteDiarioG), limiteMensualG: Number(current.limiteMensualG),
        limiteMenorG: Number(current.limiteMenorG), thcMaxMenor: current.thcMaxMenor == null ? null : Number(current.thcMaxMenor),
        cuit: current.cuit ?? "", directorMedico: current.directorMedico ?? "", responsableTecnico: current.responsableTecnico ?? "",
        directorMedicoMatricula: current.directorMedicoMatricula ?? "", responsableTecnicoTitulo: current.responsableTecnicoTitulo ?? "",
        personeria: current.personeria ?? "", reps: current.reps ?? "", domicilioLegal: current.domicilioLegal ?? "",
        aportePorGramo: current.aportePorGramo == null ? null : Number(current.aportePorGramo),
        cuotaSocialArs: current.cuotaSocialArs == null ? null : Number(current.cuotaSocialArs),
        cuotaIngresoArs: current.cuotaIngresoArs == null ? null : Number(current.cuotaIngresoArs),
        reprocannNumber: current.reprocannNumber ?? "", reprocannCode: current.reprocannCode ?? "", ...body });
      const updated = await tx.club.update({ where: { id: CLUB_ID }, data: body, omit: OMIT_IMAGES });
      await tx.auditLog.create({ data: { actorId: user.id, action: "CLUB_UPDATE", entity: "Club", entityId: CLUB_ID, ip: clientIp(req), payload: body } });
      return updated;
    }, { isolationLevel: "Serializable" });
    return json({ club });
  } catch (error) {
    return fail(error);
  }
}
