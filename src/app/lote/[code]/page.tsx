import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { fichaState } from "@/lib/batch-quality";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return { title: `Lote ${code}`, robots: { index: false, follow: false } };
}

const fmtDate = (value: Date | null) => (value ? value.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—");

/**
 * Ficha pública del lote: la que abre el QR de la etiqueta.
 * Deliberadamente neutra y sin datos personales: ni socios, ni operadores, ni saldos.
 */
export default async function PublicBatchPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const batch = await prisma.batch.findUnique({
    where: { code: decodeURIComponent(code) },
    select: { code: true, strain: { select: { name: true } }, harvestedAt: true, thcPct: true, cbdPct: true, labName: true, labDate: true, labResult: true, stage: true, releasedAt: true, recalledAt: true, recallReason: true },
  });
  if (!batch) notFound();

  const ficha = fichaState({
    stage: batch.stage,
    thcPct: batch.thcPct == null ? null : Number(batch.thcPct),
    cbdPct: batch.cbdPct == null ? null : Number(batch.cbdPct),
    labResult: batch.labResult,
    recalledAt: batch.recalledAt,
  });

  const estado = ficha.recalled
    ? { label: "Retirado del mercado", tone: "danger" }
    : !batch.releasedAt
      ? { label: "No liberado", tone: "warn" }
      : ficha.available
        ? { label: "Habilitado para entregar", tone: "ok" }
        : { label: "Sin stock disponible", tone: "mute" };

  return (
    <main className="member-main" style={{ maxWidth: 520, margin: "0 auto", padding: "28px 18px 56px" }}>
      <p className="panel-sub" style={{ margin: 0 }}>Ficha del lote · club de cultivo</p>
      <h1 className="member-intro h1" style={{ fontFamily: "var(--font-display)", fontSize: 30, margin: "6px 0 4px", letterSpacing: "-.03em" }}>{batch.code}</h1>
      <p style={{ margin: "0 0 16px", color: "var(--muted)" }}>{batch.strain.name}</p>

      {ficha.recalled ? (
        <div className="note note-bad" style={{ marginBottom: 16 }}>
          <div>
            <b>Este lote fue retirado del mercado.</b>
            {batch.recallReason ? <> Motivo: {batch.recallReason}.</> : null} No lo consumas: contactá al club.
          </div>
        </div>
      ) : null}

      <dl className="dl">
        <dt>Estado</dt><dd>{estado.label}</dd>
        <dt>Cosecha</dt><dd>{fmtDate(batch.harvestedAt)}</dd>
        <dt>THC</dt><dd>{ficha.thcLabel}</dd>
        <dt>CBD</dt><dd>{ficha.cbdLabel}</dd>
        <dt>Análisis</dt><dd>{ficha.analysisLabel}</dd>
        <dt>Laboratorio</dt><dd>{batch.labName ?? "—"}{batch.labDate ? ` · ${fmtDate(batch.labDate)}` : ""}</dd>
        <dt>Liberado</dt><dd>{batch.releasedAt ? fmtDate(batch.releasedAt) : "Pendiente de la firma de calidad"}</dd>
      </dl>

      <p className="cell-meta" style={{ marginTop: 18 }}>
        El club no vende: prorratea costos entre sus socios. Los valores de THC/CBD son los declarados por el
        laboratorio; si faltan, la ficha lo dice y no se estima un número.
      </p>
    </main>
  );
}
