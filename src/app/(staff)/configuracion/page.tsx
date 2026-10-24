import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClub } from "@/lib/club";
import { PageHead } from "@/components/ui";
import { ClubSettingsForm } from "@/components/club-settings-form";

export default async function SettingsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");
  const club = await getClub();
  return <><PageHead title="Configuración del club" subtitle="La identidad de tu asociación y las reglas que acompañan cada entrega." />
    <ClubSettingsForm initial={{ nombre: club.nombre, cuit: club.cuit ?? "", directorMedico: club.directorMedico ?? "", responsableTecnico: club.responsableTecnico ?? "", reprocannNumber: club.reprocannNumber ?? "", reprocannCode: club.reprocannCode ?? "", limiteDiarioG: Number(club.limiteDiarioG), limiteMensualG: Number(club.limiteMensualG), limiteMenorG: Number(club.limiteMenorG), edadMinima: club.edadMinima, edadLimiteMenor: club.edadLimiteMenor, thcMaxMenor: club.thcMaxMenor == null ? null : Number(club.thcMaxMenor), maxSocios: club.maxSocios, requiereReprocann: club.requiereReprocann }} />
  </>;
}
