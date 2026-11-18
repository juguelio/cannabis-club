import Link from "next/link";
import { PageHead, Panel, Chip } from "@/components/ui";
import { ColaAportes, type ComprobanteEnCola } from "@/components/cola-aportes";
import { comprobantesEnRevision } from "@/lib/comprobantes";
import { enviosPorDestino } from "@/lib/envios-destino-server";
import { esPeriodo, PERIODOS, type Periodo } from "@/lib/envios-destino";
import { cobroConfigurado, leerCobro } from "@/lib/comprobante-rules";
import { getClub } from "@/lib/club";
import { prisma } from "@/lib/db";
import { fmtDate, fmtGrams } from "@/lib/labels";

export const dynamic = "force-dynamic";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const LABEL_PERIODO: Record<Periodo, string> = {
  mes: "Este mes",
  trimestre: "3 meses",
  anio: "Este año",
};

/**
 * Aportes: el club mira la transferencia que subió el socio y decide.
 * No hay cobro automático ni pasarela; aprobar el comprobante es lo que confirma el pedido.
 */
export default async function AportesPage({ searchParams }: { searchParams: Promise<{ envios?: string }> }) {
  const sp = await searchParams;
  const periodo = esPeriodo(sp.envios) ? sp.envios : "mes";

  const [cola, club, decididos, envios] = await Promise.all([
    comprobantesEnRevision(),
    getClub(),
    prisma.paymentProof.findMany({
      where: { status: { in: ["APROBADO", "RECHAZADO"] } },
      orderBy: { reviewedAt: "desc" },
      take: 12,
      select: {
        id: true,
        status: true,
        montoArs: true,
        motivo: true,
        reviewedAt: true,
        pickup: { select: { grams: true, member: { select: { legajo: true, firstName: true, lastName: true } } } },
      },
    }),
    enviosPorDestino(periodo),
  ]);

  const cobro = leerCobro(club.cobro);
  const hayCobro = cobroConfigurado(cobro);

  // Las fechas no cruzan al cliente como Date: se serializan acá.
  const items: ComprobanteEnCola[] = cola.map((c) => ({
    id: c.id,
    pickupId: c.pickupId,
    montoArs: c.montoArs,
    referencia: c.referencia,
    mime: c.mime,
    size: c.size,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    analisis: c.analisis,
    esperado: c.esperado,
    pickup: {
      id: c.pickup.id,
      grams: c.pickup.grams,
      status: c.pickup.status,
      deliveryMode: c.pickup.deliveryMode,
      aporteEstimado: c.pickup.aporteEstimado,
      deliveryZona: c.pickup.deliveryZona,
      deliveryAddress: c.pickup.deliveryAddress,
      appointment: c.pickup.appointment ? { scheduledAt: c.pickup.appointment.scheduledAt.toISOString() } : null,
      member: c.pickup.member,
    },
  }));

  const totalPendiente = items.reduce((a, c) => a + (c.montoArs ?? 0), 0);

  return (
    <>
      <PageHead
        title="Aportes"
        subtitle="El socio transfiere el aporte de cultivo y sube el comprobante. Acá se mira y se decide: aprobar confirma el pedido."
      />

      {!hayCobro ? (
        <Panel>
          <p className="note note-warn" style={{ margin: 0 }}>
            Todavía no cargaste los datos para transferir (alias o CBU), así que el portal no puede decirle al socio a
            dónde mandar la plata.{" "}
            <Link href="/configuracion">Cargalos en Configuración › Datos de cobro</Link>.
          </p>
        </Panel>
      ) : null}

      <Panel
        title={`Esperando revisión${items.length ? ` · ${items.length}` : ""}`}
        subtitle={
          items.length
            ? `Total declarado por los socios: ${MONEY.format(totalPendiente)}. Compará con el aporte estimado de cada pedido.`
            : "Cuando un socio suba su comprobante, aparece acá."
        }
      >
        <ColaAportes inicial={items} />
      </Panel>

      <Panel
        title="Envíos por destino"
        subtitle="A dónde se fue la plata de los envíos en el período: cuántos despachos, cuántos gramos y cuánto de envío."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {PERIODOS.map((p) => (
              <Link
                key={p}
                href={`/aportes?envios=${p}`}
                className={`btn btn-sm ${p === periodo ? "btn-primary" : "btn-quiet"}`}
                scroll={false}
              >
                {LABEL_PERIODO[p]}
              </Link>
            ))}
          </div>
        }
      >
        {envios.destinos.length === 0 ? (
          <div className="empty">
            No hay envíos despachados en {envios.rango.etiqueta.toLowerCase()}. Los pedidos que se retiran en el club no
            cuentan.
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Destino</th>
                  <th className="tnum">Envíos</th>
                  <th className="tnum">Gramos</th>
                  <th className="tnum">Envío</th>
                  <th className="tnum">Aporte</th>
                  <th className="tnum">Total</th>
                </tr>
              </thead>
              <tbody>
                {envios.destinos.map((d) => (
                  <tr key={d.destino}>
                    <td>{d.destino}</td>
                    <td className="tnum">{d.envios}</td>
                    <td className="tnum">{fmtGrams(d.gramos)}</td>
                    <td className="tnum">{MONEY.format(d.costoEnvio)}</td>
                    <td className="tnum">{MONEY.format(d.aporte)}</td>
                    <td className="tnum">
                      <b>{MONEY.format(d.total)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>
                    <b>Total · {envios.rango.etiqueta}</b>
                  </td>
                  <td className="tnum">
                    <b>{envios.totales.envios}</b>
                  </td>
                  <td className="tnum">
                    <b>{fmtGrams(envios.totales.gramos)}</b>
                  </td>
                  <td className="tnum">
                    <b>{MONEY.format(envios.totales.costoEnvio)}</b>
                  </td>
                  <td className="tnum">
                    <b>{MONEY.format(envios.totales.aporte)}</b>
                  </td>
                  <td className="tnum">
                    <b>{MONEY.format(envios.totales.total)}</b>
                  </td>
                </tr>
              </tfoot>
            </table>
            <p className="cell-meta" style={{ marginTop: 8 }}>
              Agrupado por la localidad del socio; si falta, por la zona del envío. Sólo cuenta lo despachado (
              {envios.totales.destinos} {envios.totales.destinos === 1 ? "destino" : "destinos"}). Los importes son los
              congelados en cada pedido.
            </p>
          </>
        )}
      </Panel>

      <Panel title="Últimos decididos" subtitle="Queda el historial: quién aprobó, quién rechazó y por qué.">
        {decididos.length === 0 ? (
          <div className="empty">Todavía no resolviste ningún comprobante.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Socio</th>
                <th>Gramos</th>
                <th>Monto</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {decididos.map((d) => (
                <tr key={d.id}>
                  <td className="tnum">{d.reviewedAt ? fmtDate(d.reviewedAt) : "—"}</td>
                  <td>
                    <Link href={`/socios/${d.pickup.member.legajo}`}>
                      {d.pickup.member.firstName} {d.pickup.member.lastName}
                    </Link>{" "}
                    <span className="muted">· legajo {d.pickup.member.legajo}</span>
                  </td>
                  <td className="tnum">{Number(d.pickup.grams)} g</td>
                  <td className="tnum">{d.montoArs != null ? MONEY.format(Number(d.montoArs)) : "—"}</td>
                  <td>
                    <Chip tone={d.status === "APROBADO" ? "ok" : "danger"}>
                      {d.status === "APROBADO" ? "Aprobado" : "Rechazado"}
                    </Chip>
                    {d.status === "RECHAZADO" && d.motivo ? <div className="cell-meta">{d.motivo}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
