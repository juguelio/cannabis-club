import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import { tableroPedidos } from "@/lib/tablero-pedidos-server";
import { TableroPedidos } from "@/components/tablero-pedidos";

export const metadata = { title: "Pedidos" };
export const dynamic = "force-dynamic";

/**
 * La vista de trabajo del club: todos los pedidos del portal en un tablero.
 *
 * `/aportes`, `/dispensario` y `/traslados` siguen existiendo y funcionando; esto es el lugar donde se
 * sigue un pedido de punta a punta sin cambiar de pantalla.
 */
export default async function PedidosPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN" && session.role !== "OPERADOR") redirect("/");

  const { pedidos, paraPreparar } = await tableroPedidos();

  const aRevisar = pedidos.filter((p) => p.columna === "A_REVISAR").length;
  const aPreparar = pedidos.filter((p) => p.columna === "A_PREPARAR").length;

  return (
    <>
      <PageHead
        title="Pedidos"
        subtitle={
          [
            aRevisar ? `${aRevisar} para revisar` : null,
            aPreparar ? `${aPreparar} para preparar` : null,
            "Comprobante, preparación y entrega de cada pedido del portal, en un solo lugar.",
          ]
            .filter(Boolean)
            .join(" · ")
        }
      />
      <TableroPedidos pedidos={pedidos} paraPreparar={paraPreparar} />
    </>
  );
}
