import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import QRCode from "qrcode";
import { fichaState } from "@/lib/batch-quality";

export const dynamic = "force-dynamic";

const fmtDate = (value: Date | null) => (value ? value.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—");

/** Etiqueta imprimible del lote (REA 1.4): lo físico que une recall, ficha y reducción de daños. */
export default async function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await prisma.batch.findUnique({
    where: { id },
    select: { id: true, code: true, strain: { select: { name: true } }, harvestedAt: true, thcPct: true, cbdPct: true, labResult: true, stage: true, releasedAt: true, recalledAt: true },
  });
  if (!batch) notFound();

  const ficha = fichaState({
    stage: batch.stage,
    thcPct: batch.thcPct == null ? null : Number(batch.thcPct),
    cbdPct: batch.cbdPct == null ? null : Number(batch.cbdPct),
    labResult: batch.labResult,
    recalledAt: batch.recalledAt,
  });

  const base = process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "";
  const url = `${base}/lote/${encodeURIComponent(batch.code)}`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, color: { dark: "#1f2933", light: "#ffffff" } });

  return (
    <div className="stack" style={{ gap: 16, maxWidth: 460 }}>
      <Link className="crumb" href={`/stock/${batch.id}`}>← Volver al lote</Link>
      <div className="card card-pad" style={{ border: "1px solid var(--line)" }}>
        <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted)" }}>Lote</div>
        <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 650, letterSpacing: "-.02em" }}>{batch.code}</div>
        <div style={{ fontSize: 16, margin: "2px 0 14px" }}>{batch.strain.name}</div>

        <div className="flex gap-4" style={{ alignItems: "flex-start" }}>
          <div style={{ width: 116, height: 116, flex: "none" }} dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR de la ficha del lote" />
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            <div><b>Cosecha:</b> {fmtDate(batch.harvestedAt)}</div>
            <div><b>THC:</b> {ficha.thcLabel}</div>
            <div><b>CBD:</b> {ficha.cbdLabel}</div>
            <div><b>Análisis:</b> {ficha.analysisLabel}</div>
            {ficha.recalled ? <div style={{ color: "var(--danger, #b3261e)", fontWeight: 650 }}>RETIRADO DEL MERCADO</div> : null}
          </div>
        </div>

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line-soft)", fontSize: 11.5, lineHeight: 1.5, color: "var(--muted)" }}>
          <div>Uso exclusivo de socios del club. No se vende.</div>
          <div>Mantener fuera del alcance de menores. No conducir después de consumir.</div>
          <div>Escaneá el QR para ver la ficha del lote y su estado.</div>
        </div>
      </div>

      <div className="flex gap-2">
        <a className="btn" href={`/stock/${batch.id}/etiqueta?print=1`} onClick={() => setTimeout(() => window.print(), 50)}>Imprimir</a>
        <Link className="btn btn-quiet" href={`/lote/${batch.code}`} target="_blank">Ver ficha pública</Link>
      </div>
      <p className="cell-meta" style={{ margin: 0 }}>
        La etiqueta no lleva datos del socio ni del operador: el QR abre una ficha neutra del lote.
      </p>
    </div>
  );
}
