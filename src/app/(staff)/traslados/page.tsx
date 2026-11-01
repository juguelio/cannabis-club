import Link from "next/link";
import { prisma } from "@/lib/db";
import { Chip, Empty, PageHead, Panel } from "@/components/ui";
import { ShipmentForm } from "@/components/shipment-form";
import { EnvioPedidos } from "@/components/envio-pedidos";
import { fmtDate, fmtGrams } from "@/lib/labels";
import { listShipments, resolveShipmentStatus, totalGrams } from "@/lib/shipments";
import { Truck } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "mute" }> = {
  PREPARACION: { label: "En preparación", tone: "warn" },
  DESPACHADO: { label: "Despachado", tone: "warn" },
  ENTREGADO: { label: "Entregado", tone: "ok" },
  CANCELADO: { label: "Cancelado", tone: "mute" },
};

const MODE: Record<string, string> = { AEREO: "Aéreo", TERRESTRE: "Terrestre" };

/** Traslados: lo que sale del club hacia pacientes que no retiran en sede. */
export default async function ShipmentsPage() {
  const [shipments, club, pedidos, abiertos, lotes, saldos] = await Promise.all([
    listShipments(),
    prisma.club.findFirst({ select: { nombreCorto: true, nombre: true } }),
    // Lo que el socio pidió enviar desde el portal y todavía no salió.
    prisma.pickupRequest.findMany({
      where: { deliveryMode: "ENVIO", status: { in: ["SOLICITADA", "CONFIRMADA"] } },
      orderBy: { createdAt: "asc" },
      include: { member: { select: { id: true, legajo: true, firstName: true, lastName: true } } },
    }),
    prisma.shipment.findMany({ where: { status: "PREPARACION" }, select: { id: true, code: true }, orderBy: { createdAt: "desc" } }),
    prisma.batch.findMany({
      where: { stage: { in: ["CURADO", "DISPONIBLE"] }, releasedAt: { not: null }, recalledAt: null },
      select: { id: true, code: true, strain: { select: { name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.$queryRaw<{ batchId: string; balance: unknown }[]>`
      SELECT "batchId", COALESCE(SUM(CASE WHEN type IN ('INGRESO', 'AJUSTE_POSITIVO', 'DISPENSACION_REVERSA') THEN grams ELSE -grams END), 0) AS balance
      FROM "StockMovement" GROUP BY "batchId"
    `,
  ]);
  const balance = new Map(saldos.map((s) => [s.batchId, Number(s.balance)]));
  const loteOpciones = lotes
    .map((b) => ({ id: b.id, code: b.code, strain: b.strain.name, available: Math.round((balance.get(b.id) ?? 0) * 100) / 100 }))
    .filter((b) => b.available > 0);
  const envios = pedidos.map((p) => ({
    id: p.id,
    memberId: p.memberId,
    memberName: `${p.member.lastName}, ${p.member.firstName}`,
    legajo: p.member.legajo,
    grams: Number(p.grams),
    zona: p.deliveryZona,
    costoArs: p.deliveryCostoArs == null ? null : Number(p.deliveryCostoArs),
    direccion: p.deliveryAddress,
    creado: p.createdAt.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
  }));
  const origin = club?.nombreCorto ?? club?.nombre ?? "Sede del club";

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHead
        title="Traslados"
        subtitle="Lo que sale del club hacia un paciente que no retira en sede: quién lo lleva, a dónde, con qué DDJJ."
        actions={<ShipmentForm defaultFrom={origin} />}
      />

      <Panel title="Cómo funciona" subtitle="Tres pasos, en este orden">
        <div className="stack" style={{ gap: 8 }}>
          <div><b>1.</b> Se abre el traslado con destino y responsable.</div>
          <div><b>2.</b> Se agregan los pacientes con lote y gramos, y se marca la <b>DDJJ firmada</b> de cada uno. Sin eso no sale.</div>
          <div><b>3.</b> Al entregar, cada paciente pasa por los controles del dispensario y deja asiento en el libro. El estado no se toca a mano.</div>
        </div>
      </Panel>

      <Panel
        title="Pedidos de envío del portal"
        subtitle={
          envios.length === 0
            ? "Ninguno pendiente: cuando un socio pide envío, aparece acá."
            : `${envios.length} ${envios.length === 1 ? "pedido" : "pedidos"} esperando salir con un traslado`
        }
      >
        {envios.length === 0 ? (
          <Empty icon={Truck} title="Sin pedidos de envío">
            El socio los hace desde su portal, eligiendo zona y domicilio. Se cargan en el traslado con el lote y
            viajan con su DDJJ.
          </Empty>
        ) : abiertos.length === 0 ? (
          <div className="note note-warn">
            <div>
              Hay {envios.length} {envios.length === 1 ? "pedido" : "pedidos"} pero ningún traslado abierto. Abrí uno con
              «Nuevo traslado» y volvé acá para cargarlos.
            </div>
          </div>
        ) : (
          <EnvioPedidos pedidos={envios} traslados={abiertos} lotes={loteOpciones} />
        )}
      </Panel>

      <Panel title="Traslados" subtitle={`${shipments.length} registrados`}>
        {shipments.length === 0 ? (
          <Empty icon={Truck} title="Todavía no hay traslados">
            Abrí el primero con «Nuevo traslado». Sirve para aéreo y terrestre.
          </Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Destino</th>
                <th>Cuándo</th>
                <th>Pacientes</th>
                <th className="num">Gramos</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => {
                const effective = resolveShipmentStatus(
                  s.status,
                  s.items.map((i) => ({ dispensationId: i.dispensationId, dispensationVoidedAt: i.dispensation?.voidedAt ?? null })),
                );
                const meta = STATUS[effective] ?? { label: effective, tone: "mute" as const };
                const entregados = s.items.filter((i) => i.dispensationId && !i.dispensation?.voidedAt).length;
                return (
                  <tr key={s.id}>
                    <td>
                      <Link className="link-strong" href={`/traslados/${s.id}`}>{s.code}</Link>
                      <div className="cell-meta">{MODE[s.mode] ?? s.mode} · {s.carrierName}</div>
                    </td>
                    <td>{s.toAddress}</td>
                    <td>{fmtDate(s.plannedAt ?? s.createdAt)}</td>
                    <td>{s.items.length}{entregados > 0 ? ` · ${entregados} entregados` : ""}</td>
                    <td className="num tnum">{fmtGrams(totalGrams(s.items))}</td>
                    <td><Chip tone={meta.tone}>{meta.label}</Chip></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
