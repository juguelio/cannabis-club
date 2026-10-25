import Link from "next/link";
import { prisma } from "@/lib/db";
import { Chip, Empty, PageHead, Panel } from "@/components/ui";
import { ShipmentForm } from "@/components/shipment-form";
import { fmtDate, fmtGrams } from "@/lib/labels";
import { listShipments, totalGrams } from "@/lib/shipments";
import { Truck } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "mute" }> = {
  PREPARACION: { label: "En preparación", tone: "warn" },
  DESPACHADO: { label: "Despachado", tone: "warn" },
  ENTREGADO: { label: "Entregado", tone: "ok" },
  CANCELADO: { label: "Cancelado", tone: "mute" },
};

export const MODE: Record<string, string> = { AEREO: "Aéreo", TERRESTRE: "Terrestre" };

/** Traslados: lo que sale del club hacia pacientes que no retiran en sede. */
export default async function ShipmentsPage() {
  const [shipments, club] = await Promise.all([
    listShipments(),
    prisma.club.findFirst({ select: { nombreCorto: true, nombre: true } }),
  ]);
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
                const meta = STATUS[s.status] ?? { label: s.status, tone: "mute" as const };
                const entregados = s.items.filter((i) => i.dispensationId).length;
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
