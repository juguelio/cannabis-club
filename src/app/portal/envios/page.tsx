import { redirect } from "next/navigation";
import Link from "next/link";
import { Truck } from "lucide-react";
import { getMemberSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getClub } from "@/lib/club";
import { preciosDeClub } from "@/lib/precios";
import { zonaPorCp } from "@/lib/envios";

export const metadata = { title: "Envíos" };
export const dynamic = "force-dynamic";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

/**
 * La política de envíos, escrita donde el socio la puede leer antes de armar el pedido.
 *
 * Es lo que hacen los clubes que lo hacen bien (Doobiez publica zonas, mínimos y qué pasa si no hay
 * nadie): el socio no debería descubrir el costo ni la demora recién al confirmar, ni enterarse de
 * que no llegamos a su zona después de elegir todo.
 */
export default async function EnviosPage() {
  const session = await getMemberSession();
  if (!session) redirect("/login");

  const [club, member] = await Promise.all([
    getClub(),
    prisma.member.findUnique({ where: { id: session.memberId }, select: { postalCode: true, locality: true } }),
  ]);

  const precios = preciosDeClub(club);
  const cobertura = zonaPorCp(member?.postalCode, precios.envios);

  return (
    <main className="stack" style={{ gap: 18, paddingBottom: 40 }}>
      <nav className="cell-meta">
        <Link href="/portal">← Volver al portal</Link>
      </nav>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Truck aria-hidden size={19} /> Envíos
            </h2>
            <p className="panel-sub">
              El club despacha a domicilio con transporte propio en AMBA y con Andreani al interior. El envío es un costo
              logístico: no es una venta ni cambia el aporte de cultivo, que se prorratea por gramo.
            </p>
          </div>
        </div>
        <div className="panel-body">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12.5, textTransform: "uppercase", letterSpacing: ".06em" }}>
                <th style={{ padding: "6px 0" }}>Zona</th>
                <th style={{ padding: "6px 0" }}>Costo</th>
                <th style={{ padding: "6px 0" }}>Demora</th>
              </tr>
            </thead>
            <tbody>
              {precios.envios.map((z) => (
                <tr key={z.zona} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "9px 0" }}>
                    <b>{z.zona}</b>
                    {z.transportista ? <span className="cell-meta"> · {z.transportista}</span> : null}
                  </td>
                  <td style={{ padding: "9px 0" }} className="tnum">
                    {MONEY.format(z.precioArs)}
                  </td>
                  <td style={{ padding: "9px 0" }}>{z.demora}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul style={{ margin: "14px 0 0", paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
            <li>
              <b>Mínimo de envío: {precios.minimoEnvioG} g.</b> Por debajo de eso no se despacha; en el carrito te
              avisamos cuánto falta.
            </li>
            <li>
              <b>Máximo por envío: {precios.maxMembresiasPorEnvio * precios.membresiaGramos} g.</b> Si necesitás más, van
              en despachos separados.
            </li>
            <li>
              <b>No elegís día: el envío es libre.</b> Pedís cuando quieras y el club despacha cuando prepara el
              pedido. La demora de tu zona es orientativa y cuenta desde el despacho, no desde el pedido.
            </li>
            <li>
              <b>Tiene que haber alguien para recibir.</b> Si el domicilio está incompleto o no hay quien reciba, el
              paquete vuelve y se reprograma.
            </li>
            <li>
              <b>Sólo a socios con REPROCANN vigente y legajo verificado.</b> Sin eso el club no puede despachar.
            </li>
          </ul>

          <p className="cell-meta" style={{ marginTop: 12 }}>
            Tu zona:{" "}
            {cobertura.estado === "CUBIERTA" ? (
              <>
                <b>{cobertura.zona.zona}</b> · {MONEY.format(cobertura.zona.precioArs)} · {cobertura.zona.demora}
                {cobertura.aproximada ? ` (${cobertura.motivo})` : ""}
              </>
            ) : cobertura.estado === "SIN_CP" ? (
              <>
                no la podemos calcular porque falta tu código postal.{" "}
                <Link href="/portal/datos" style={{ fontWeight: 650, textDecoration: "underline" }}>
                  Completar mis datos
                </Link>
              </>
            ) : cobertura.estado === "SIN_ZONAS" ? (
              <>todavía no hay zonas de envío cargadas: por ahora sólo retiro en el club.</>
            ) : (
              <>
                <b>no llegamos con envío a {cobertura.cp}</b>: {cobertura.motivo}. Podés retirar en el club.
              </>
            )}
          </p>
        </div>
      </section>
    </main>
  );
}
