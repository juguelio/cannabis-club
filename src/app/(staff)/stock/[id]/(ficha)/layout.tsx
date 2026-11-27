import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Chip } from "@/components/ui";
import { LoteNav } from "@/components/lote-nav";
import { STAGE } from "@/lib/labels";
import { contextoLote } from "./contexto";
import "@/components/ficha-nav.css";

export default async function Layout({ params, children }: { params: Promise<{ id: string }>; children: React.ReactNode }) {
  const { id } = await params;
  const { batch } = await contextoLote(id);
  return <>
      <Link className="crumb" href="/stock"><ArrowLeft aria-hidden /> Stock y lotes</Link>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">{batch.code}</h1>
          <p className="page-sub flex flex-wrap items-center gap-2" style={{ marginTop: 10 }}>
            <Chip tone={STAGE[batch.stage]?.tone}>{STAGE[batch.stage]?.label}</Chip>
            <span>{batch.strain.name}{batch.strain.genetics ? `, ${batch.strain.genetics.toLowerCase()}` : ""}</span>
          </p>
        </div>
        <Link className="btn btn-sm btn-quiet" href={`/stock/${id}/etiqueta`}>Etiqueta con QR</Link>
      </div>
      <div className="legajo-grid"><LoteNav id={id} /><div className="legajo-contenido">{children}</div></div>
  </>;
}
