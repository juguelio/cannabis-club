import Image from "next/image";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Chip, Meter, Panel } from "@/components/ui";
import { fmtGrams } from "@/lib/labels";
import { contextoLote } from "./contexto";

export const metadata = { title: "Resumen del lote" };
export default async function Resumen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { batch, t } = await contextoLote(id);
  const foto = await prisma.batchPhoto.findFirst({ where: { batchId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, updatedAt: true } });
  const dry = Number(batch.dryWeightG ?? 0);
  return <div className="stack">
    <Panel title="Estado del lote"><div className="panel-body stack">
      <div><Chip tone={batch.recalledAt ? "danger" : batch.releasedAt ? "ok" : "warn"}>
        {batch.recalledAt ? "Retirado del mercado" : batch.releasedAt ? "Liberado" : "Sin liberar"}
      </Chip></div>
      <Link href={`/stock/${id}/calidad`}>Ver calidad y liberación</Link>
    </div></Panel>
          {batch.dryWeightG ? (
            <Panel title="Saldo del lote">
              <div className="panel-body">
                <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
                  <span className="big-g">{fmtGrams(t.balanceG).replace(" g", "")}<small>g</small></span>
                  <span className="cell-meta">de {fmtGrams(dry)} secos</span>
                </div>
                <Meter value={t.balanceG} max={dry || t.balanceG} tone={t.balanceG < Math.max(30, dry * 0.15) ? "warn" : "ok"} />
                <dl className="dl" style={{ marginTop: 16, gridTemplateColumns: "1fr auto" }}>
                  <dt>Ingresado</dt><dd className="num">{fmtGrams(t.ingresadoG)}</dd>
                  <dt>Entregado a socios</dt><dd className="num">{fmtGrams(t.entregadoG)}</dd>
                  <dt>Destruido</dt><dd className="num">{fmtGrams(t.destruidoG)}</dd>
                  {t.transferidoG ? <><dt>Transferido</dt><dd className="num">{fmtGrams(t.transferidoG)}</dd></> : null}
                  {t.ajustesG ? <><dt>Ajustes netos</dt><dd className="num">{t.ajustesG > 0 ? "+" : ""}{fmtGrams(t.ajustesG)}</dd></> : null}
                </dl>
              </div>
            </Panel>
          ) : <Panel title="Saldo del lote"><p className="panel-body">Pendiente de registrar el peso seco.</p></Panel>}

    {foto && <Panel title="Última foto del lote"><Link href={`/stock/${id}/fotos`} className="panel-body stack">
      <Image unoptimized width={480} height={300} alt={`Última foto de ${batch.code}`}
        src={`/api/batches/${id}/fotos/${foto.id}?v=${foto.updatedAt.getTime()}`}
        style={{ width: "100%", height: 200, objectFit: "contain" }} />
      Ver galería
    </Link></Panel>}
  </div>;
}
