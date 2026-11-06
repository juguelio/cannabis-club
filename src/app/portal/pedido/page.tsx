import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/auth";
import { portalOverview } from "@/lib/pickups";
import { catalogoDelClub } from "@/lib/variedades";
import { CheckoutPedido, type CheckoutData } from "@/components/checkout-pedido";

export const metadata = { title: "Hacer el pedido" };
export const dynamic = "force-dynamic";

export default async function PedidoPage() {
  const session = await getMemberSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/portal/clave");

  const [overview, variedades] = await Promise.all([portalOverview(session.memberId), catalogoDelClub()]);

  const data: CheckoutData = {
    tope: overview.tope,
    aportePorGramo: overview.club.aportePorGramo,
    minimoEnvioG: overview.club.minimoEnvioG ?? 0,
    topeEnvioG: overview.club.topeEnvioG,
    envios: overview.club.envios.map((z) => ({
      zona: z.zona,
      precioArs: z.precioArs,
      demora: z.demora,
      transportista: z.transportista ?? null,
    })),
    cobro: overview.club.cobro ?? null,
    cobertura: overview.club.cobertura ?? { estado: "SIN_ZONAS" },
    member: {
      address: overview.member.address,
      locality: overview.member.locality,
      province: overview.member.province ?? null,
      postalCode: overview.member.postalCode,
    },
  };

  return <CheckoutPedido data={data} nombreDe={Object.fromEntries(variedades.map((v) => [v.id, v.nombre]))} />;
}
