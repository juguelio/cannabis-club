import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/auth";
import { getClub } from "@/lib/club";
import { preciosDeClub } from "@/lib/precios";
import { portalOverview } from "@/lib/pickups";
import { catalogoDelClub } from "@/lib/variedades";
import { BasketView } from "@/components/basket-view";

export const metadata = { title: "Tu basket" };
export const dynamic = "force-dynamic";

export default async function BasketPage() {
  const session = await getMemberSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/portal/clave");

  const [club, overview, variedades] = await Promise.all([
    getClub(),
    portalOverview(session.memberId),
    catalogoDelClub(),
  ]);
  const precios = preciosDeClub(club);
  const nombreDe = Object.fromEntries(variedades.map((v) => [v.id, v.nombre]));

  return (
    <BasketView
      tope={overview.tope}
      aportePorGramo={overview.club.aportePorGramo}
      minimoEnvioG={precios.minimoEnvioG}
      topeEnvioG={overview.club.topeEnvioG}
      nombreDe={nombreDe}
    />
  );
}
