import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Chip, Field, PageHead, Panel } from "@/components/ui";
import { ShipmentItemForm } from "@/components/shipment-item-form";
import { DdjjToggle, ShipmentActions } from "@/components/shipment-actions";
import { fmtDate, fmtDateTime, fmtGrams, plural } from "@/lib/labels";
import { canDispatch, resolveShipmentStatus, shipmentDetail, totalGrams } from "@/lib/shipments";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "mute" }> = {
  PREPARACION: { label: "En preparación", tone: "warn" },
  DESPACHADO: { label: "Despachado", tone: "warn" },
  ENTREGADO: { label: "Entregado", tone: "ok" },
  CANCELADO: { label: "Cancelado", tone: "mute" },
};
const MODE: Record<string, string> = { AEREO: "Aéreo", TERRESTRE: "Terrestre" };

export default async function ShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shipment = await shipmentDetail(id);
  if (!shipment) notFound();

  const [members, batches, totals] = await Promise.all([
    prisma.member.findMany({
      where: { status: { in: ["ACTIVO", "SUSPENDIDO"] } },
      select: { id: true, legajo: true, firstName: true, lastName: true, docLast4: true },
      orderBy: { legajo: "asc" },
    }),
    prisma.batch.findMany({
      where: { stage: { in: ["CURADO", "DISPONIBLE", "CUARENTENA"] }, releasedAt: { not: null }, recalledAt: null },
      select: { id: true, code: true, strain: { select: { name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.$queryRaw<{ batchId: string; balance: unknown }[]>`
      SELECT "batchId", COALESCE(SUM(CASE WHEN type IN ('INGRESO', 'AJUSTE_POSITIVO', 'DISPENSACION_REVERSA') THEN grams ELSE -grams END), 0) AS balance
      FROM "StockMovement" GROUP BY "batchId"
    `,
  ]);
  const balanceOf = new Map(totals.map((t) => [t.batchId, Number(t.balance)]));
  const batchOptions = batches
    .map((b) => ({ id: b.id, code: b.code, strain: b.strain.name, available: Math.round((balanceOf.get(b.id) ?? 0) * 100) / 100 }))
    .filter((b) => b.available > 0);

  const effective = resolveShipmentStatus(
    shipment.status,
    shipment.items.map((i) => ({ dispensationId: i.dispensationId, dispensationVoidedAt: i.dispensation?.voidedAt ?? null })),
  );
  const meta = STATUS[effective] ?? { label: effective, tone: "mute" as const };
  const ready = canDispatch(shipment.items.map((i) => ({ grams: Number(i.grams), ddjjSignedAt: i.ddjjSignedAt })));

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHead
        back={{ href: "/traslados", label: "Traslados" }}
        title={shipment.code}
        subtitle={`${MODE[shipment.mode] ?? shipment.mode} · ${shipment.toAddress}`}
        actions={
          <div className="flex items-center gap-2">
            <Link className="btn btn-quiet btn-sm" href={`/traslados/${shipment.id}/remito`}>Remito</Link>
            <ShipmentActions id={shipment.id} status={effective} />
          </div>
        }
      />

      <Panel title="Estado" subtitle={`${plural(shipment.items.length, "paciente", "pacientes")} · ${fmtGrams(totalGrams(shipment.items))}`} action={<Chip tone={meta.tone}>{meta.label}</Chip>}>
        <div className="grid-2">
          <Field label="Sale desde" value={shipment.fromAddress} />
          <Field label="Destino" value={shipment.toAddress} />
          <Field label="Responsable" value={`${shipment.carrierName}${shipment.carrierDoc ? ` · ${shipment.carrierDoc}` : ""}`} />
          <Field label="Aviso previo" value={shipment.noticeRef ?? "Sin constancia cargada"} />
          <Field label="Previsto" value={shipment.plannedAt ? fmtDate(shipment.plannedAt) : "—"} />
          <Field label="Despachado" value={shipment.departedAt ? fmtDateTime(shipment.departedAt) : "Todavía no"} />
          <Field label="Entregado" value={shipment.deliveredAt ? fmtDateTime(shipment.deliveredAt) : "Todavía no"} />
          <Field label="Abierto por" value={shipment.createdBy.name} />
        </div>
        {shipment.status === "PREPARACION" && !ready.ok ? (
          <div className="note note-warn" style={{ marginTop: 14 }}>
            <b>No puede salir todavía.</b> <span>{ready.reason}</span>
          </div>
        ) : null}
        {shipment.notes ? <p className="cell-meta" style={{ marginTop: 12, whiteSpace: "pre-line" }}>{shipment.notes}</p> : null}
      </Panel>

      <Panel title="Pacientes del traslado" subtitle="Cada paciente lleva su DDJJ firmada y su credencial REPROCANN.">
        {shipment.items.length === 0 ? (
          <p className="cell-meta" style={{ margin: 0 }}>Todavía no hay pacientes cargados.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Lote</th>
                <th className="num">Gramos</th>
                <th>DDJJ</th>
                <th>Entrega</th>
                {shipment.status === "PREPARACION" ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {shipment.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link className="link-strong" href={`/socios/${item.memberId}`}>{item.member.lastName}, {item.member.firstName}</Link>
                    <div className="cell-meta">Legajo {item.member.legajo}{item.member.docLast4 ? ` · DNI ····${item.member.docLast4}` : ""}</div>
                  </td>
                  <td>
                    {item.batch.code}
                    <div className="cell-meta">{item.batch.strain?.name ?? ""}</div>
                  </td>
                  <td className="num tnum">{fmtGrams(item.grams)}</td>
                  <td>
                    {item.ddjjSignedAt ? <Chip tone="ok">Firmada {fmtDate(item.ddjjSignedAt)}</Chip> : <Chip tone="danger">Falta</Chip>}
                  </td>
                  <td>
                    {item.dispensationId && item.dispensation?.voidedAt ? (
                      <Chip tone="danger">Anulada</Chip>
                    ) : item.dispensationId ? (
                      <Chip tone="ok">Registrada</Chip>
                    ) : (
                      <span className="cell-meta">Pendiente</span>
                    )}
                  </td>
                  {shipment.status === "PREPARACION" ? (
                    <td className="num"><DdjjToggle shipmentId={shipment.id} itemId={item.id} signed={Boolean(item.ddjjSignedAt)} /></td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {shipment.status === "PREPARACION" ? (
        <Panel title="Agregar paciente" subtitle="Sólo lotes liberados y con stock">
          <ShipmentItemForm
            shipmentId={shipment.id}
            members={members.map((m) => ({ id: m.id, legajo: m.legajo, name: `${m.lastName}, ${m.firstName}`, docLast4: m.docLast4 }))}
            batches={batchOptions}
          />
        </Panel>
      ) : null}
    </div>
  );
}
