import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtDate, fmtGrams } from "@/lib/labels";
import { shipmentDetail, totalGrams } from "@/lib/shipments";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

const MODE: Record<string, string> = { AEREO: "Aéreo", TERRESTRE: "Terrestre" };

/**
 * Remito del traslado: la hoja que viaja con la materia vegetal. Lleva sólo lo que hay que mostrar
 * en un control (paciente, legajo, lote, gramos, DDJJ) y **no** datos clínicos ni de contacto.
 */
export default async function RemitoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [shipment, club] = await Promise.all([shipmentDetail(id), prisma.club.findFirst({ select: { nombre: true, nombreCorto: true, cuit: true, reprocannNumber: true } })]);
  if (!shipment) notFound();

  const total = totalGrams(shipment.items);

  return (
    <div className="stack" style={{ gap: 14, maxWidth: 760 }}>
      <div className="no-print flex items-center justify-between gap-2">
        <Link className="crumb" href={`/traslados/${shipment.id}`}>← Volver al traslado</Link>
        <PrintButton />
      </div>

      <div className="card card-pad" style={{ border: "1px solid var(--line)" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="cell-meta" style={{ textTransform: "uppercase", letterSpacing: ".12em" }}>Remito de traslado</div>
            <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 650, letterSpacing: "-.02em" }}>{shipment.code}</div>
            <div style={{ fontSize: 14 }}>{MODE[shipment.mode] ?? shipment.mode} · {fmtDate(shipment.departedAt ?? shipment.plannedAt ?? shipment.createdAt)}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13 }}>
            <div style={{ fontWeight: 600 }}>{club?.nombre ?? "Asociación civil"}</div>
            {club?.cuit ? <div className="cell-meta">CUIT {club.cuit}</div> : null}
            {club?.reprocannNumber ? <div className="cell-meta">REPROCANN {club.reprocannNumber}</div> : null}
          </div>
        </div>

        <div className="grid-2" style={{ marginTop: 18 }}>
          <div><div className="label">Sale desde</div><div>{shipment.fromAddress}</div></div>
          <div><div className="label">Destino</div><div>{shipment.toAddress}</div></div>
          <div><div className="label">Quién traslada</div><div>{shipment.carrierName}{shipment.carrierDoc ? ` · ${shipment.carrierDoc}` : ""}</div></div>
          <div><div className="label">Aviso previo</div><div>{shipment.noticeRef ?? "—"}</div></div>
        </div>

        <table className="table" style={{ marginTop: 18 }}>
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Legajo</th>
              <th>Lote</th>
              <th>Variedad</th>
              <th className="num">Gramos</th>
              <th>DDJJ</th>
            </tr>
          </thead>
          <tbody>
            {shipment.items.map((item) => (
              <tr key={item.id}>
                <td>{item.member.lastName}, {item.member.firstName}</td>
                <td className="tnum">{item.member.legajo}</td>
                <td className="tnum">{item.batch.code}</td>
                <td>{item.batch.strain?.name ?? "—"}</td>
                <td className="num tnum">{fmtGrams(item.grams)}</td>
                <td>{item.ddjjSignedAt ? "Firmada" : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={4}>Total</th>
              <th className="num tnum">{fmtGrams(total)}</th>
              <th />
            </tr>
          </tfoot>
        </table>

        <div className="cell-meta" style={{ marginTop: 16, lineHeight: 1.5 }}>
          Cada paciente lleva su credencial REPROCANN y su declaración jurada firmada. Este remito acompaña la materia
          vegetal durante el traslado y no reemplaza la documentación del paciente.
        </div>

        <div className="flex justify-between" style={{ marginTop: 34, gap: 24 }}>
          <div style={{ flex: 1, borderTop: "1px solid var(--line)", paddingTop: 6, fontSize: 12 }}>Firma de quien entrega</div>
          <div style={{ flex: 1, borderTop: "1px solid var(--line)", paddingTop: 6, fontSize: 12 }}>Firma de quien recibe</div>
        </div>
      </div>
    </div>
  );
}
